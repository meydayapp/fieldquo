// app/i18n/savingsPage/en.js
//
// English source of truth for /savings.
//
// ══ Why this is a directory and not another block in messages.js ═══════════
//
// 153 keys times nine languages is 1,377 strings. comparePages/ and
// featurePages/ made the same move for the same reason, and their headers
// carry the argument: a block that size inside messages.js makes every other
// key in that file harder to find, and nine sessions editing one file is how
// a merge eats a translation.
//
// ══ The copy is duplicated from lib/marketing/savings.js, on purpose ═══════
//
// Every assumption, line item and exclusion below is the same sentence the
// module exports. The module keeps them because they are the PUBLISHED
// ASSUMPTION — scripts/check-savings.mjs reads them, asserts that a reason is
// a reason and not a restatement, and that a figure attributed to contractors
// cites its range. That check runs under plain node with no React and no
// language context, so it cannot read a catalogue.
//
// So the module stays the record and this is the translation of it, keyed by
// the module's own stable ids. scripts/check-savings-i18n.mjs asserts the two
// are character-identical in English, which is what stops them drifting —
// the same device check:marketing-i18n uses for the /compare copy.
//
// ══ What is NOT translated ════════════════════════════════════════════════
//
// The figures. Every number on the page is grouped for the reader's locale at
// render time (app/i18n/numberLocale.js), and the sentences below carry
// {placeholders} where those figures land. A translator moving a placeholder
// is fine; deleting one silently drops a number out of a claim.
//
// The page metadata also stays English — same decision, and the same reason,
// as /compare/[slug]: a <title> is what a crawler keeps for months, and
// serving it in whatever language the last visitor picked is worse than not
// translating it. Locale-prefixed routes are the real fix and are scoped in
// docs/ROADMAP.md.

export const SAVINGS_PAGE_EN = {
  "marketing.savings.page.title": "What would FieldQuo be worth to you?",
  "marketing.savings.page.intro": "{required} answers plus {optional} you can give us if you know it, {lines} line items, and every coefficient behind them published further down the page — including where each one came from and which end of a range we took. We have deliberately left out the things we cannot put an honest number on, and they are listed too.",
  "marketing.savings.form.title": "Your business",
  "marketing.savings.form.optional": "(optional)",
  "marketing.savings.form.placeholder": "e.g. {value}",
  "marketing.savings.form.outOfRange": "Needs to be between {min} and {max} — we would rather ask again than guess what you meant.",
  "marketing.savings.empty.title": "No figure yet.",
  "marketing.savings.empty.outOfRange": "One of the answers above is outside what we can read. Nothing is estimated from a number we had to invent.",
  "marketing.savings.empty.unanswered": "Fill in the questions above and the estimate appears here. We will not show you a number built on answers you have not given.",
  "marketing.savings.estimate.title": "What we think it is worth, a year",
  "marketing.savings.estimate.notEstimated": "Not estimated: {label}",
  "marketing.savings.estimate.total": "Estimated saving, a year",
  "marketing.savings.estimate.capped": "Held to {revenue} — the work you told us you invoice in a year. On the answers given, the lines above added up to more than that, and a tool claiming to save a business more than it turns over has stopped describing that business.",
  "marketing.savings.cost.title": "Against what it costs",
  "marketing.savings.cost.planLabel": "Plan that fits you",
  "marketing.savings.cost.planValue": "{plan} — {monthly} a month",
  "marketing.savings.cost.planSeats": "{seats} writing quotes and invoices, {crew} crew included free.",
  "marketing.savings.cost.yearLabel": "A year, month by month",
  "marketing.savings.cost.yearNote": "Committing to a year is {committed} — pay for {payFor}, get {months}. The comparison below uses the higher, monthly figure.",
  "marketing.savings.cost.leftOver": "Left over",
  "marketing.savings.cost.shortBy": "Short by",
  "marketing.savings.cost.leftOverNote": "What the estimate above is worth after the subscription.",
  "marketing.savings.cost.shortByNote": "On these answers it does not pay for itself, and we would rather say so than hide the comparison.",
  "marketing.savings.cost.plansLink": "See what is in every plan",
  "marketing.savings.cost.offLadder": "The published plans go up to {seats} people writing quotes and invoices and {crew} crew. You are past that, so there is no price on the list to compare against and we will not invent one.",
  "marketing.savings.cost.offLadderCta": "Talk to us",
  "marketing.savings.notCounted.title": "Things we did not put a number on",
  "marketing.savings.notCounted.intro": "These are real and included. They are missing from the total because any figure we gave them would have been made up.",
  "marketing.savings.assumptions.title": "Every number behind the estimate",
  "marketing.savings.assumptions.colWhat": "What it is",
  "marketing.savings.assumptions.colValue": "Value",
  "marketing.savings.assumptions.colWhy": "Why that value",
  "marketing.savings.basis.arithmetic": "A definition",
  "marketing.savings.basis.product": "Read off our own price list",
  "marketing.savings.basis.reported": "Contractors' own reported figures",
  "marketing.savings.basis.estimate": "Our estimate",
  "marketing.savings.cta.title": "The honest way to check any of this is on your own jobs.",
  "marketing.savings.cta.body": "The first month is free, and there is no contract.",
  "marketing.savings.cta.button": "Start free",
  "marketing.savings.unit.minutes.one": "{n} minute",
  "marketing.savings.unit.minutes.other": "{n} minutes",
  "marketing.savings.unit.days.one": "{n} day",
  "marketing.savings.unit.days.other": "{n} days",
  "marketing.savings.line.quote_writing.workings": "{quotes} quotes a month × {months} months × {saved} saved on each ({source}; {fieldquo} from a price book) × {hourly} an hour",
  "marketing.savings.line.quote_writing.sourceAnswered": "{minutes} is the figure you gave us",
  "marketing.savings.line.quote_writing.sourceDefault": "{minutes} of desk work today is our figure, because you left the box blank",
  "marketing.savings.line.under_billing.workings": "{revenue} invoiced a year × {share} of it done and never charged — recovered whole, because the labour and the materials are already spent",
  "marketing.savings.line.change_orders.workings": "{revenue} invoiced a year × {share} of it in extras that were agreed, done, and never added to the bill",
  "marketing.savings.line.quotes_chased.workings": "{unwon} of quotes a year that did not become work × {recovery} chased back × {margin} margin, because you still have to do the job",
  "marketing.savings.line.admin_time.workings": "{hours} hours a week × {share} × {weeks} weeks × {hourly} an hour",
  "marketing.savings.line.invoice_sooner.workings": "{revenue} invoiced a year, {days} sooner, at {cost} a year for the money",
  "marketing.savings.omit.quote_writing.noQuotes": "You told us you send no quotes in a month, so there is no quote-writing time here to shorten.",
  "marketing.savings.omit.quote_writing.alreadyFast": "You told us a quote takes you {minutes}, which is already at or under what it takes here, so there is nothing on this line for us to claim.",
  "marketing.savings.omit.quotes_chased.winsAll": "You win everything you quote, on the numbers you gave us. There is nothing here to chase.",
  "marketing.savings.field.seats.label": "People who write quotes, jobs or invoices",
  "marketing.savings.field.seats.help": "Anyone in the office or on the road who creates or changes the paperwork. This is what a plan is priced on.",
  "marketing.savings.field.crew.label": "People in the field who just need their schedule",
  "marketing.savings.field.crew.help": "They see their work, clock in and upload photos. They are included free on every plan, so this changes the price only by deciding which plan fits.",
  "marketing.savings.field.quotesPerMonth.label": "Quotes you send in a month",
  "marketing.savings.field.quotesPerMonth.help": "All of them, won or not. This drives the largest line on the page, so we ask rather than assume.",
  "marketing.savings.field.quoteDeskMinutes.label": "How long one quote takes you today, in minutes",
  "marketing.savings.field.quoteDeskMinutes.help": "Working out the quantities, pricing them, writing it up and sending it. NOT the drive and not the walk round the job — those are left out of this page altogether, deliberately. Leave it blank and we use the figure in the table below instead, and the workings will say we did.",
  "marketing.savings.field.projectsPerMonth.label": "Jobs you finish in a month",
  "marketing.savings.field.projectsPerMonth.help": "Completed work, not enquiries.",
  "marketing.savings.field.averageProjectValue.label": "What an average job invoices for",
  "marketing.savings.field.averageProjectValue.help": "Before tax. In whichever money you invoice in — we do not convert.",
  "marketing.savings.field.adminHoursPerWeek.label": "Hours a week the office spends on scheduling, invoicing and chasing paperwork",
  "marketing.savings.field.adminHoursPerWeek.help": "Not the time spent writing quotes — that is the question above, and counting it here as well would count the same hour twice. Everyone's hours added together, in a typical week.",
  "marketing.savings.field.hourlyCost.label": "What an hour of that time costs you",
  "marketing.savings.field.hourlyCost.help": "Wage plus what you carry on top of it. If it is your own time — and writing quotes usually is — what you would bill that hour at. In whichever money you invoice in — we do not convert.",
  "marketing.savings.field.tools.label": "How you run it today",
  "marketing.savings.field.tools.help": "This moves four of the numbers below, so there is no default — the answer has to come from you.",
  "marketing.savings.field.tools.option.paper": "Paper, spreadsheets and a shared calendar",
  "marketing.savings.field.tools.option.separate_apps": "A few apps that do not talk to each other",
  "marketing.savings.assumption.quote_desk_minutes_today.label": "Desk time an estimate takes you today, when you do not tell us",
  "marketing.savings.assumption.quote_desk_minutes_today.represents": "The part of producing one estimate that happens at a desk — working out the quantities, pricing them, writing the thing up and formatting it. Not the drive and not the walkthrough; those are left out of this page entirely, and the note further down says so.",
  "marketing.savings.assumption.quote_desk_minutes_today.reasoning": "Raised from 45, because 45 was under the published floor rather than conservative. Blaze Estimating puts the range at 120–180 minutes — most builders spend two to three hours building a single detailed quote (blazeestimating.com/how-long-does-a-construction-estimate-take). One contractor's own experience agrees with the bottom of it: FieldQuo's owner runs a cabinet business, prices jobs weekly, and puts the same work at about two hours with no travel in it at all — quantities, pricing, writing it up, sending. We take that bottom end, 120. The top of the same published range, 180, is equally reported and would make this line half again as large; taking it would be the drift this table exists to refuse. The scope of the row has not changed and travel is still excluded — only the number moved. If it is wrong for your trade, the box above this table is where you say so, and your answer replaces ours.",
  "marketing.savings.assumption.quote_desk_minutes_fieldquo.label": "Desk time the same estimate takes with a price book",
  "marketing.savings.assumption.quote_desk_minutes_fieldquo.represents": "The same desk work, when the rates, the material quantities and the wording are already saved and the measurements did not have to be taken by hand.",
  "marketing.savings.assumption.quote_desk_minutes_fieldquo.reasoning": "Lowered from 15, and the reason it moved is that 15 described a different product: it cited contractors working from saved templates in OTHER software — an honest source for a weaker mechanism, and not for this one. What FieldQuo does is not a template. Your rates and material recipes are already in the price book, a roof or a lot is measured off the address rather than by hand, and one button sends it in your colours. A minute is FieldQuo's owner's figure for that path on his own jobs. Marked as OUR ESTIMATE and not as contractors' reported figures, deliberately, and the distinction is the point of this column: it is one operator's number with no range behind it, and a row that claimed a survey it does not have would be exactly the citation-shaped sentence with no citation this table refuses. Not marked as read off our own price list either — the interactions are countable and we counted them (a roofing quote is about four, because one satellite click fills the sloped area and the pitch together and the tear-off, the steep-pitch surcharge and every linear-foot detail price themselves; a staircase is about the same, because one complexity pick seeds all seven rates) — but how long four interactions take a human is not something a codebase can measure, and we are not going to dress a judgement up as a reading. Which way it leans, since that is what this basis owes you: generous. An interior painting quote still needs the dimensions of every room typed, and a countertop still needs a supplier cost per line, because stone has no rate card to default from. One number across four trades flatters the slower two, and what would move it is splitting the row per trade.",
  "marketing.savings.assumption.tools_paper_admin_share.label": "Office time reclaimed — paper and spreadsheets today",
  "marketing.savings.assumption.tools_paper_admin_share.represents": "The share of the remaining office hours you told us about — scheduling, invoicing and chasing the paperwork, NOT writing quotes — that stops existing when it is one system instead of three places you re-type into.",
  "marketing.savings.assumption.tools_paper_admin_share.reasoning": "Raised from a quarter, and only because the question underneath it changed: writing quotes is now its own line and has been taken out of the hours you report here. What is left is the part we remove hardest — an approved quote becomes the invoice with nobody re-keying it, and the job carries its own schedule — so it is a larger fraction of a smaller number. It is still not everything: the phone calls, the chasing of materials and the answering of clients are in there and they do not go away.",
  "marketing.savings.assumption.tools_apps_admin_share.label": "Office time reclaimed — separate apps today",
  "marketing.savings.assumption.tools_apps_admin_share.represents": "The same share, for a business already running a few apps that do not talk to each other.",
  "marketing.savings.assumption.tools_apps_admin_share.reasoning": "You have already bought back the worst of it. What is left is the copying between apps, which is less than the copying from paper — so this stays well under the figure above rather than being a token reduction, and it moved by the same amount for the same reason.",
  "marketing.savings.assumption.under_billing_paper_share.label": "Work you did and did not charge for — paper and spreadsheets today",
  "marketing.savings.assumption.under_billing_paper_share.represents": "The share of a year's work that was inside the job you agreed, was done, and never made it onto the invoice: a line item dropped when the invoice was typed up from memory, a material run nobody put against the job, hours nobody logged, the wrong tax rate for where the work was.",
  "marketing.savings.assumption.under_billing_paper_share.reasoning": "The comparison this page sits beside puts this at 1.8% of a year for a business on paper. We are not in a position to verify their figure and we do not need to: what we can defend is the part of it our own mechanism reaches. The invoice is generated from the approved quote rather than re-keyed, which removes the commonest error outright; costing runs against the quoted price so work that ran over is visible before the invoice goes rather than after; materials and hours land against the job that incurred them; the tax comes from the service address. That is most of the list but not all of it, and none of it makes anybody log an hour they chose not to log — so this is set at two thirds of the figure the comparison rests on rather than matching it.",
  "marketing.savings.assumption.under_billing_apps_share.label": "Work you did and did not charge for — separate apps today",
  "marketing.savings.assumption.under_billing_apps_share.represents": "The same, for a business already invoicing from an app.",
  "marketing.savings.assumption.under_billing_apps_share.reasoning": "Half the figure above, on the same reasoning that halves it in the comparison: an app already catches some of this. The re-keying between the quote app and the invoice app is what it does not catch, and that is the step this removes.",
  "marketing.savings.assumption.change_order_paper_share.label": "Extras agreed on site and never invoiced — paper today",
  "marketing.savings.assumption.change_order_paper_share.represents": "The share of a year's work that is extra the client ASKED FOR after the price was agreed — the scope grew — which was done and never added to the bill.",
  "marketing.savings.assumption.change_order_paper_share.reasoning": "This is not the row above and the two must not be read as one: that one is work already inside the job that fell off the invoice, this one is work the job did not originally contain. Extras go unbilled because at the moment they are agreed the paperwork is already out, and redoing it feels like a bigger job than eating the cost. Amending an invoice here takes about a minute from a phone, keeps the original version, and records the reason and the person — so the reason it goes unwritten is the reason that is removed. The comparison puts this at 2% of a year; ours is set near seventy per cent of that, because a fast amendment removes the excuse but still needs somebody to open it.",
  "marketing.savings.assumption.change_order_apps_share.label": "Extras agreed on site and never invoiced — separate apps today",
  "marketing.savings.assumption.change_order_apps_share.represents": "The same, for a business already invoicing from an app.",
  "marketing.savings.assumption.change_order_apps_share.reasoning": "Lower for the same reason as the row above and by the same proportion against the comparison's own 1.25%: an app makes a second invoice easier than a duplicate book does. What it does not do is keep the first version beside the second, which is the part that stops the conversation about what was agreed.",
  "marketing.savings.assumption.tools_paper_invoice_days.label": "Days sooner the invoice is raised — paper and spreadsheets today",
  "marketing.savings.assumption.tools_paper_invoice_days.represents": "How much earlier the invoice goes out when it is built from the approved quote the moment the client approves, rather than written up when someone next sits down with the paperwork.",
  "marketing.savings.assumption.tools_paper_invoice_days.reasoning": "This is about when the invoice is RAISED, not how the client pays it. A paperwork evening that happens about weekly means an average job waits several days for its invoice; five is under half a week and ignores the jobs that wait a fortnight.",
  "marketing.savings.assumption.tools_apps_invoice_days.label": "Days sooner the invoice is raised — separate apps today",
  "marketing.savings.assumption.tools_apps_invoice_days.represents": "The same, for a business already invoicing from an app.",
  "marketing.savings.assumption.tools_apps_invoice_days.reasoning": "An app you already have shortens this but does not remove it, because the invoice still has to be typed from the quote by hand. Three days is the conservative end.",
  "marketing.savings.assumption.cost_of_money.label": "What waiting for your money costs, a year",
  "marketing.savings.assumption.cost_of_money.represents": "The annual cost of not having money you have earned — what you pay to borrow it, or what it would have earned working.",
  "marketing.savings.assumption.cost_of_money.reasoning": "We do not know what you borrow at. Eight per cent is at the bottom of what a small trades business pays for operating credit; an overdraft or a card costs several times that, and a business that is never short of cash values it at less. We would rather be under for everyone than right for some.",
  "marketing.savings.assumption.quote_recovery_share.label": "Quotes that went quiet and come back when chased",
  "marketing.savings.assumption.quote_recovery_share.represents": "Of the quotes you send that do not turn into work, the share that turns into work anyway once a scheduled follow-up chases them for you.",
  "marketing.savings.assumption.quote_recovery_share.reasoning": "We have no measurement of this and will not pretend otherwise. Raised from three in a hundred to four, deliberately: a sequence that fires on its own schedule and never forgets is a different thing from a contractor who means to ring back and does not. Four is still below every figure published for follow-up sequences that we are aware of and would not cite without having read, and what comes back is counted at margin, which is what keeps this line from carrying the total.",
  "marketing.savings.assumption.gross_margin.label": "The share of a job that is actually yours",
  "marketing.savings.assumption.gross_margin.represents": "What is left of a job's price after the materials and the labour to do it.",
  "marketing.savings.assumption.gross_margin.reasoning": "A job you have not yet won is not money in your pocket — you still have to do it. Counting a recovered job at its full invoice value is the single biggest way a calculator like this inflates a total, so recovered work is counted at margin only. Note that this coefficient does NOT apply to work already done and never billed: there the cost is already spent, so recovering the bill recovers all of it. Thirty per cent is conservative for trades where materials and labour dominate; if you know your own, it is the number to substitute.",
  "marketing.savings.assumption.weeks_per_year.label": "Weeks in a year",
  "marketing.savings.assumption.weeks_per_year.represents": "Turning a weekly figure into an annual one.",
  "marketing.savings.assumption.weeks_per_year.reasoning": "A definition. It is not discounted for holidays, which would cut the office-hours line by a few per cent — the hours you gave us are a typical week, and pretending you take five weeks off is as much an invention as pretending you take none.",
  "marketing.savings.assumption.months_per_year.label": "Months in a year",
  "marketing.savings.assumption.months_per_year.represents": "Turning a monthly figure into an annual one.",
  "marketing.savings.assumption.months_per_year.reasoning": "A definition. The jobs and quotes figures you gave us are treated as a typical month and repeated twelve times; a seasonal trade has a busy half and a quiet one, and we have no way to ask about that without turning the questions above into twenty.",
  "marketing.savings.assumption.days_per_year.label": "Days in a year",
  "marketing.savings.assumption.days_per_year.represents": "Turning a cost of money per year into a cost per day waited.",
  "marketing.savings.assumption.days_per_year.reasoning": "A definition. Calendar days rather than working days, which is the conservative choice here: counting only working days would make each day of waiting worth about forty per cent more.",
  "marketing.savings.assumption.minutes_per_hour.label": "Minutes in an hour",
  "marketing.savings.assumption.minutes_per_hour.represents": "Turning minutes saved on a quote into a share of the hourly cost you told us about.",
  "marketing.savings.assumption.minutes_per_hour.reasoning": "A definition. It is here rather than written into the formula because a bare 60 inside a multiplication is indistinguishable from a coefficient somebody chose, and this file's whole argument is that you can tell the difference by looking at the table.",
  "marketing.savings.line.quote_writing.label": "The time it takes to price a job",
  "marketing.savings.line.quote_writing.mechanism": "Your rates and your material quantities are already in the system, the roof or the driveway can be measured from the address instead of by hand, and one button sends it in your colours. What is left is deciding what is in the job — which is your work, not typing.",
  "marketing.savings.line.under_billing.label": "Work you did and did not charge for",
  "marketing.savings.line.under_billing.mechanism": "The invoice is generated from the quote the client approved rather than re-typed from memory, so a line item cannot go missing between the two. What the job actually cost in labour, materials and expenses is set against what you quoted before the invoice goes out, not discovered afterwards. Hours land against the job that incurred them, materials are recorded on the job rather than in a glovebox, and the tax rate comes from the address the work was at.",
  "marketing.savings.line.change_orders.label": "Extras the client asked for and never got billed",
  "marketing.savings.line.change_orders.mechanism": "The client adds something while you are standing there and the invoice is already out. Amending it takes about a minute from your phone: the original version is kept, the new one records what changed and who changed it, and there is no argument later about what was agreed. The reason extras go unwritten is that redoing the paperwork feels bigger than eating the cost — that is the reason this removes.",
  "marketing.savings.line.quotes_chased.label": "Work you would not have chased",
  "marketing.savings.line.quotes_chased.mechanism": "A quote that goes quiet gets followed up on your schedule and in your words. What comes back is counted at what it leaves you, not at what it invoices.",
  "marketing.savings.line.admin_time.label": "Office hours you get back",
  "marketing.savings.line.admin_time.mechanism": "Scheduling and invoicing are the same system as the quote. The client approves and the invoice is built from it — nobody re-types the job into a second place, and nobody types it into a third to put it in the calendar.",
  "marketing.savings.line.invoice_sooner.label": "What the invoice going out sooner is worth",
  "marketing.savings.line.invoice_sooner.mechanism": "The invoice exists the moment the quote is approved, rather than waiting for the evening someone does the paperwork — and an invoice that goes past its date is chased on a schedule you set, without you remembering.",
  "marketing.savings.notCounted.receptionist.subject": "The receptionist answering while you are up a ladder",
  "marketing.savings.notCounted.receptionist.reason": "It answers, takes the details and books the visit — but it bills by the minute on top of your plan, and we know neither how many calls you miss nor how many of them were work. Pricing it would be two guesses stacked on a cost we would have had to leave out.",
  "marketing.savings.notCounted.card_payment.subject": "Clients paying by card from their phone",
  "marketing.savings.notCounted.card_payment.reason": "They can, and the money settles into your account. But card processing has a fee, and we do not know what it costs you to get paid today. Counting the speed and ignoring the fee would flatter this total in the one direction it must not be flattered.",
  "marketing.savings.notCounted.drive_and_walk.subject": "The drive out and the walk round the job",
  "marketing.savings.notCounted.drive_and_walk.reason": "The quote line above counts only the desk work — the measuring up, the pricing, the writing and the sending. Getting there and looking at the work is most of a visit and we do not remove it, so it is not in the total. A calculator that counted the drive would be counting time you are still going to spend.",
  "marketing.savings.notCounted.fewer_arguments.subject": "Fewer arguments about what was agreed",
  "marketing.savings.notCounted.fewer_arguments.reason": "Every version of an invoice is kept with the reason it changed and the name against it. What that is worth the day a client disputes one is real and we cannot put a figure on it, so we have not.",
  "marketing.savings.notCounted.booking_and_site.subject": "Work your booking page and website bring in",
  "marketing.savings.notCounted.booking_and_site.reason": "Both are real and both are included. How much work they win depends on your area, your trade and your reputation, and none of that is in the answers above.",
  "marketing.savings.ai.headline": "The AI is not a bigger plan.",
  "marketing.savings.ai.body": "Quote review before you send, and asking questions about your own numbers in plain English, are on every plan including the smallest one — there is no tier to move up to for them. The phone assistant and the texting are the ones you pay for as you use them, by the minute and by the message, and they still do not need a bigger plan. None of that is in the figures above, because we would have to guess how many calls you take.",
  "marketing.savings.disclosure.headline": "These are estimates, and here is exactly what they rest on.",
  "marketing.savings.disclosure.body": "Every figure on this page is built from the answers you typed and the coefficients in the table below — nothing is measured from your business, because we cannot see it. Where a number is a judgement rather than a definition the table says so, and where it came from contractors rather than from us the table says that too, with the range they reported and which end we took. Two of the lines are worth less than they look and are counted that way: money arriving sooner is worth the cost of waiting for it, not the money itself, and a job you have not yet won is worth its margin, not its invoice. Two others are worth their full value and the table explains why — work already done and never billed has no cost left to net off. If a line looks wrong against your own books, your books are right.",
  "marketing.savings.currency.short": "Answer in whichever money you invoice in. We do not convert, and every figure below stays in the money you typed.",
  "marketing.savings.currency.long": "Type your own money and read the answers back in it: this page does no conversion and prints no symbol, because it has no way of knowing which one you use and will not guess from where you are sitting. One set of prices, too — which money you are billed in comes from the business address you give when you sign up: Canadian companies in Canadian dollars, US companies in US dollars, the same number either way rather than a converted one.",
};

export default SAVINGS_PAGE_EN;
