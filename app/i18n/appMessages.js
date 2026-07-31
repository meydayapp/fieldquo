// app/i18n/appMessages.js
//
// The message catalogue for /app — the contractor's back office.
//
// ── Why a second file rather than more keys in messages.js ─────────────────
//
// messages.js is the MARKETING catalogue: six languages of landing-page copy,
// already ~1000 lines. The app surface is several times larger, changes for
// completely different reasons, and is read by a different audience. Merged
// into one file, every app string edit would collide with marketing copy edits
// and neither would be findable.
//
// Both are merged into MESSAGES at the bottom of messages.js, so `t()` and the
// coverage script keep working unchanged and there is still exactly one lookup.
//
// ── Why English and French only ────────────────────────────────────────────
//
// Not a shortcut — a deliberate limit, and the app has to be honest about it.
//
// The marketing catalogue carries six languages because it's a few hundred
// short strings. The app is ~640 distinct strings across 78 files. Machine
// translating that into four more languages without anyone who reads them
// checking the result would put unreviewed text on the screens staff work in
// all day — including payroll and invoicing screens, where a mistranslated
// label is a costly misunderstanding rather than an awkward sentence.
//
// English and French are the two that matter for the market this product sells
// into. The other supported languages still work everywhere they already did —
// client quotes, invoices, PDFs and the emails carrying them — because those
// are translated per DOCUMENT, not per interface. `appCoverage()` below reports
// the real figure per language, and the language settings page prints it rather
// than implying the interface is translated when it isn't.
//
// Adding a language means filling in a whole object here and nothing else.

// ── English: the source of truth ───────────────────────────────────────────
//
// Flat, dot-namespaced keys, matching messages.js. Flat means `t("app.nav.jobs")`
// is one lookup, and grepping the key finds both the use and every translation.
const en = {
  // ── Navigation ───────────────────────────────────────────────────────────
  "app.nav.home": "Home",
  "app.nav.ai": "FieldQuo AI",

  "app.nav.group.work": "Work",
  "app.nav.requests": "Leads",
  "app.nav.quotes": "Quotes",
  "app.nav.estimateReviews": "Estimate Reviews",
  "app.nav.jobs": "Jobs",
  "app.nav.invoices": "Invoices",
  "app.nav.calendar": "Calendar",
  "app.nav.tasks": "To-do",

  "app.nav.group.people": "People",
  "app.nav.clients": "Clients",
  "app.nav.team": "Your team",
  "app.nav.teamSchedule": "Team Schedule",
  "app.nav.timesheets": "Timesheets",
  "app.nav.timeOff": "Time Off",

  "app.nav.group.money": "Money",
  "app.nav.payroll": "Payroll",
  "app.nav.expenses": "Expenses",
  "app.nav.insights": "Insights",

  "app.nav.group.grow": "Grow",
  "app.nav.marketing": "Marketing",
  "app.nav.receptionist": "Receptionist",
  "app.nav.crewInbox": "Crew inbox",
  "app.nav.refer": "Refer & Earn",

  "app.nav.help": "Help",
  "app.nav.plan": "Plan",
  "app.nav.settings": "Settings",
  "app.nav.logOut": "Log Out",

  // The floating "+" menu. Singular on purpose — these create ONE of a thing,
  // where the nav items above open a list.
  "app.quickAdd.title": "Create",
  "app.quickAdd.client": "Client",
  "app.quickAdd.request": "Request",
  "app.quickAdd.quote": "Quote",
  "app.quickAdd.job": "Job",
  "app.quickAdd.invoice": "Invoice",

  "app.sidebar.collapse": "Collapse sidebar",
  "app.sidebar.expand": "Expand sidebar",
  "app.sidebar.openMenu": "Open menu",
  "app.sidebar.closeMenu": "Close menu",

  // ── Actions ──────────────────────────────────────────────────────────────
  //
  // The verbs that appear on every screen. Worth their own namespace: a
  // per-screen "Save" would be translated dozens of times, and the copies are
  // the ones that end up inconsistent.
  "app.action.save": "Save",
  "app.action.saving": "Saving…",
  "app.action.saved": "Saved",
  "app.action.cancel": "Cancel",
  "app.action.delete": "Delete",
  "app.action.deleting": "Deleting…",
  "app.action.edit": "Edit",
  "app.action.add": "Add",
  "app.action.create": "Create",
  "app.action.remove": "Remove",
  "app.action.close": "Close",
  "app.action.back": "Back",
  "app.action.next": "Next",
  "app.action.previous": "Previous",
  "app.action.done": "Done",
  "app.action.confirm": "Confirm",
  "app.action.search": "Search",
  "app.action.filter": "Filter",
  "app.action.export": "Export",
  "app.action.download": "Download",
  "app.action.upload": "Upload",
  "app.action.send": "Send",
  "app.action.sending": "Sending…",
  "app.action.duplicate": "Duplicate",
  "app.action.archive": "Archive",
  "app.action.restore": "Restore",
  "app.action.refresh": "Refresh",
  "app.action.retry": "Try again",
  "app.action.viewAll": "View all",
  "app.action.learnMore": "Learn more",
  "app.action.copyLink": "Copy link",
  "app.action.copied": "Copied",
  "app.action.print": "Print",
  "app.action.preview": "Preview",
  "app.action.apply": "Apply",
  "app.action.clear": "Clear",
  "app.action.selectAll": "Select all",

  // ── State ────────────────────────────────────────────────────────────────
  "app.state.loading": "Loading…",
  "app.state.empty": "Nothing here yet",
  "app.state.noResults": "No results",
  "app.state.error": "Something went wrong",
  "app.state.required": "Required",
  "app.state.optional": "Optional",
  "app.state.unsaved": "Unsaved changes",
  "app.state.comingSoon": "Coming soon",

  // ── Document statuses ────────────────────────────────────────────────────
  //
  // These are shown to STAFF. The client-facing versions of the same words live
  // in lib/i18n/documentLabels.js and are translated per document language, not
  // per interface language — a French quote says "Envoyé" even when the person
  // who sent it reads the app in English.
  "app.status.draft": "Draft",
  "app.status.sent": "Sent",
  "app.status.viewed": "Viewed",
  "app.status.approved": "Approved",
  "app.status.declined": "Declined",
  "app.status.expired": "Expired",
  "app.status.paid": "Paid",
  "app.status.partiallyPaid": "Partially paid",
  "app.status.overdue": "Overdue",
  "app.status.scheduled": "Scheduled",
  "app.status.inProgress": "In progress",
  "app.status.completed": "Completed",
  "app.status.cancelled": "Cancelled",
  "app.status.pending": "Pending",
  "app.status.active": "Active",
  "app.status.inactive": "Inactive",
  "app.status.new": "New",
  "app.status.won": "Won",
  "app.status.lost": "Lost",

  // ── Time ─────────────────────────────────────────────────────────────────
  "app.time.today": "Today",
  "app.time.yesterday": "Yesterday",
  "app.time.tomorrow": "Tomorrow",
  "app.time.thisWeek": "This week",
  "app.time.thisMonth": "This month",
  "app.time.thisYear": "This year",
  "app.time.lastWeek": "Last week",
  "app.time.lastMonth": "Last month",
  "app.time.allTime": "All time",
  "app.time.custom": "Custom range",
  "app.time.hours": "hours",
  "app.time.minutes": "minutes",
  "app.time.days": "days",

  // ── Settings navigation ──────────────────────────────────────────────────
  "app.settings.title": "Settings",
  "app.settings.search": "Search settings",

  "app.settings.group.account": "Account",
  "app.settings.accountBilling": "Account & Billing",
  "app.settings.refer": "Refer & Earn",
  "app.settings.productUpdates": "Product Updates",

  "app.settings.group.business": "Business",
  "app.settings.company": "Company Settings",
  "app.settings.branding": "Branding",
  "app.settings.language": "Language",

  "app.settings.group.team": "Team & scheduling",
  "app.settings.team": "Manage Team",
  "app.settings.availability": "Availability",
  "app.settings.leave": "Time Off Policies",
  "app.settings.bookingPage": "Booking Page",
  "app.settings.workAreas": "Work Areas",

  "app.settings.group.pricing": "Services & pricing",
  "app.settings.products": "Products & Services",
  "app.settings.services": "Services & Pricing",
  "app.settings.materials": "Materials",
  "app.settings.materialCosts": "Material Costs",
  "app.settings.cabinetRates": "Cabinet Pricing",
  "app.settings.overhead": "Overhead",
  "app.settings.payroll": "Payroll",
  "app.settings.customFields": "Custom Fields",

  "app.settings.group.documents": "Documents & messaging",
  "app.settings.emailTemplates": "Email Templates",
  "app.settings.pdfTemplates": "PDF Templates",
  "app.settings.emailDomain": "Email Domain",
  "app.settings.translations": "Translations",
  "app.settings.followUps": "Follow-ups",
  "app.settings.notifications": "Notifications",
  "app.settings.checklists": "Checklists",

  "app.settings.group.paid": "Getting paid",
  "app.settings.payments": "Payments",
  "app.settings.expenseTracking": "Expense Tracking",

  "app.settings.group.clientFacing": "Client-facing",
  "app.settings.website": "Your website",
  "app.settings.instantQuotes": "Instant Quotes",
  "app.settings.leadForm": "Share your links",
  "app.settings.voice": "Phone receptionist",
  "app.settings.reviews": "Reviews",
  "app.settings.messages": "Client messages",

  "app.settings.group.records": "Records",
  "app.settings.activity": "Activity Log",

  // ── Dashboard ────────────────────────────────────────────────────────────
  "app.dash.title": "Dashboard",
  "app.dash.subtitle": "Here's what's happening with your business.",
  "app.dash.revenueThisMonth": "Revenue this month",
  "app.dash.quotesSent": "Quotes sent",
  "app.dash.conversionRate": "Conversion rate",
  "app.dash.upcomingVisits": "Upcoming visits",
  "app.dash.recentQuotes": "Recent Quotes",
  "app.dash.upcomingAppointments": "Upcoming Appointments",
  "app.dash.noQuotes": "No quotes yet.",
  "app.dash.nothingScheduled": "Nothing scheduled.",
  "app.dash.scheduleAppointment": "Schedule Appointment",
  "app.dash.viewClients": "View Clients",

  // ── List screens ─────────────────────────────────────────────────────────
  "app.quotes.title": "Quotes",
  "app.quotes.subtitle": "Manage customer quotes.",
  "app.quotes.new": "New Quote",
  "app.quotes.search": "Search quotes...",
  "app.quotes.empty": "Create your first quote",

  "app.jobs.title": "Jobs",
  "app.jobs.subtitle": "Scheduled and in-progress work.",
  "app.jobs.new": "New Job",
  "app.jobs.search": "Search jobs...",
  "app.jobs.empty": "No jobs in this view.",
  "app.jobs.recurring": "Recurring",

  "app.invoices.title": "Invoices",
  "app.invoices.subtitle": "Track payments and billing.",
  "app.invoices.new": "New Invoice",
  "app.invoices.search": "Search invoices...",
  "app.invoices.totalBilled": "Total Billed",
  "app.invoices.outstanding": "Outstanding",

  "app.clients.title": "Clients",
  "app.clients.new": "New Client",
  "app.clients.import": "Import",
  "app.clients.search": "Search clients...",
  "app.clients.empty": "Add your first client",
  "app.clients.contractor": "Contractor",

  // ── Common form fields — reused across every create/edit screen ───────────
  "app.field.name": "Name",
  "app.field.phone": "Phone",
  "app.field.email": "Email",
  "app.field.address": "Address",
  "app.field.city": "City",
  "app.field.province": "Province",
  "app.field.notes": "Notes",

  // ── New / edit client form ────────────────────────────────────────────────
  "app.clientNew.back": "Back to Clients",
  "app.clientNew.type": "Client type",
  "app.clientNew.homeowner": "Homeowner",
  "app.clientNew.homeownerHint": "An individual — jobs are at their address",
  "app.clientNew.company": "Company / Contractor",
  "app.clientNew.companyHint": "A business — job sites vary per job",
  "app.clientNew.companyName": "Company name",
  "app.clientNew.contactPerson": "Contact person",
  "app.clientNew.contactPlaceholder": "Who you deal with there",
  "app.clientNew.businessAddress": "Business address (optional)",
  "app.clientNew.addressPlaceholder": "Start typing an address...",
  "app.clientNew.businessAddressHint": "This is their office. Each job's actual site address is set on the quote or job itself.",
  "app.clientNew.nameRequired": "Client name is required",
  "app.clientNew.createError": "Could not create client",
  "app.clientNew.creating": "Creating...",
  "app.clientNew.create": "Create Client",

  // ── Import clients (CSV) ──────────────────────────────────────────────────
  "app.clientImport.title": "Import Clients",
  "app.clientImport.subtitle": "Upload a CSV exported from another system. Expected columns: name, email, phone, address, city, province.",
  "app.clientImport.readError": "Could not read that file — make sure it's a valid CSV",
  "app.clientImport.failed": "Import failed",
  "app.clientImport.choose": "Click to choose a CSV file",
  "app.clientImport.found": "Found {count} rows. Preview of the first 3:",
  "app.clientImport.noContact": "no contact info",
  "app.clientImport.importing": "Importing...",
  "app.clientImport.importN": "Import {count} clients",
  "app.clientImport.imported": "Imported {count} clients",
  "app.clientImport.skipped": " ({count} skipped — missing a name)",
  "app.clientImport.view": "View Clients",

  // ── Client detail ─────────────────────────────────────────────────────────
  "app.clientDetail.notFound": "Client not found.",
  "app.clientDetail.contactSuffix": "contact person",
  "app.clientDetail.office": "office",
  "app.clientDetail.jobSitesVary": "Job sites vary for contractors — each quote or job carries its own location.",
  "app.clientDetail.companyDefaultLang": "Company default ({lang})",
  "app.clientDetail.docsEmails": "documents & emails",
  "app.clientDetail.newQuote": "New Quote",
  "app.clientDetail.newJob": "New Job",
  "app.clientDetail.noQuotes": "No quotes yet.",
  "app.clientDetail.noJobs": "No jobs yet.",
  "app.clientDetail.noInvoices": "No invoices yet.",
  "app.clientDetail.edit": "Edit Client",
  "app.clientDetail.saveChanges": "Save Changes",
  "app.clientDetail.langHint": "Quotes, invoices and emails go out in this language.",
  "app.clientDetail.saveError": "Could not save",
  "app.clientDetail.quoteFallback": "Quote",
  "app.clientDetail.invoiceFallback": "Invoice",

  // ── Leads ────────────────────────────────────────────────────────────────
  "app.leads.title": "Leads",
  "app.leads.subtitle": "Enquiries from your booking page and contact forms.",
  "app.leads.empty": "No leads yet",
  "app.leads.emptyHint": "Enquiries land here when someone fills in your public booking page.",
  "app.leads.startQuote": "Start a quote",
  "app.leads.nothingHere": "Nothing here",

  // ── Appointments ─────────────────────────────────────────────────────────
  "app.appts.title": "Appointments",
  "app.appts.subtitle": "In-person visits and site assignments.",
  "app.appts.new": "New Appointment",
  "app.appts.empty": "No appointments in this view.",
  "app.appts.clientName": "Client name",
  "app.appts.dateTime": "Date & time",
  "app.appts.location": "Location",
  "app.appts.siteAddress": "Site address",
  "app.appts.assignTo": "Assign to",
  "app.appts.unassigned": "Unassigned",
  "app.appts.supervisorRequired": "Supervisor required",
  "app.appts.supervisorHint": "Requires a senior supervisor on site",

  // ── Time off ─────────────────────────────────────────────────────────────
  "app.timeOff.title": "Time off",
  "app.timeOff.subtitle": "Request time off and see what you have left.",
  "app.timeOff.request": "Request time off",
  "app.timeOff.mine": "Mine",
  "app.timeOff.yourRequests": "Your requests",
  "app.timeOff.awaitingApproval": "Awaiting approval",
  "app.timeOff.nothingToApprove": "Nothing to approve.",
  "app.timeOff.noneUpcoming": "Nobody has approved time off coming up.",
  "app.timeOff.viewOnly": "You can see requests but not approve them.",
  "app.timeOff.balances": "Balances this year",
  "app.timeOff.noBalance": "No balance has accrued yet this year.",
  "app.timeOff.accrued": "Accrued",
  "app.timeOff.taken": "Taken",
  "app.timeOff.left": "Left",
  "app.timeOff.policy": "Policy",
  "app.timeOff.person": "Person",
  "app.timeOff.type": "Type",
  "app.timeOff.firstDay": "First day",
  "app.timeOff.lastDay": "Last day",
  "app.timeOff.halfDayOnly": "Half day only",
  "app.timeOff.note": "Note (optional)",
  "app.timeOff.notePlaceholder": "Anything your manager should know",
  "app.timeOff.earlier": "Earlier",

  // ── Team schedule ────────────────────────────────────────────────────────
  "app.schedule.title": "Team Schedule",
  "app.schedule.nextTwoWeeks": "Next 2 weeks",
  "app.schedule.noAvailability": "No availability set",
  "app.schedule.noMembers": "No team members yet.",

  // ── Payroll ──────────────────────────────────────────────────────────────
  "app.payroll.title": "Payroll",
  "app.payroll.runs": "Pay runs",
  "app.payroll.newRun": "New pay run",
  "app.payroll.saveDraft": "Save as draft run",
  "app.payroll.noRuns": "No pay runs yet.",
  "app.payroll.myEarnings": "My earnings",
  "app.payroll.noPayslips": "No payslips yet. They appear once a pay run is approved.",
  "app.payroll.ownPayslipsOnly": "Only your own payslips are shared with your account.",
  "app.payroll.nothingApproved": "Nobody has approved hours or a salary in this period.",
  "app.payroll.periodStart": "Period start",
  "app.payroll.periodEnd": "Period end",
  "app.payroll.frequency": "Frequency",
  "app.payroll.payslipLabels": "Payslip labels",
  "app.payroll.downloadPayslip": "Download this payslip as a PDF",
  "app.payroll.payYourself": "You pay through your own bank or payroll provider",

  // ── Activity, help, estimate reviews ─────────────────────────────────────
  "app.activity.title": "Activity Log",
  "app.activity.empty": "No activity recorded yet.",

  "app.help.title": "Help Centre",

  "app.reviews.title": "Estimate Reviews",
  "app.reviews.empty": "Nothing waiting. New instant estimates from your website will appear here.",
  "app.reviews.supervisorOnly": "Only a supervisor, admin or owner can approve.",
  "app.reviews.openQuote": "Open quote",
  "app.reviews.approveAt": "Approve at",
  "app.reviews.property": "Property",
  "app.reviews.material": "Material:",

  // ── Job detail & timesheets ──────────────────────────────────────────────
  "app.job.backToJobs": "Back to jobs",
  "app.job.client": "Client",
  "app.job.visits": "Visits",
  "app.job.addVisit": "Add visit",
  "app.job.noVisits": "No visits scheduled yet. Add one to put this job on the calendar.",

  "app.timesheets.title": "Timesheets",
  "app.timesheets.subtitle": "Review and approve logged hours.",
  "app.timesheets.empty": "No time entries yet.",
  "app.timesheets.approve": "Approve",
};

// ── French ─────────────────────────────────────────────────────────────────
//
// Québécois usage, not France: "soumission" for a quote and "facture" for an
// invoice are what a contractor in Gatineau writes on the document itself, and
// the interface should use the same word as the paperwork.
const fr = {
  "app.nav.home": "Accueil",
  "app.nav.ai": "FieldQuo IA",

  "app.nav.group.work": "Travail",
  "app.nav.requests": "Prospects",
  "app.nav.quotes": "Soumissions",
  "app.nav.estimateReviews": "Révision des estimations",
  "app.nav.jobs": "Chantiers",
  "app.nav.invoices": "Factures",
  "app.nav.calendar": "Calendrier",
  "app.nav.tasks": "À faire",

  "app.nav.group.people": "Personnel",
  "app.nav.clients": "Clients",
  "app.nav.team": "Votre équipe",
  "app.nav.teamSchedule": "Horaire de l'équipe",
  "app.nav.timesheets": "Feuilles de temps",
  "app.nav.timeOff": "Congés",

  "app.nav.group.money": "Finances",
  "app.nav.payroll": "Paie",
  "app.nav.expenses": "Dépenses",
  "app.nav.insights": "Analyses",

  "app.nav.group.grow": "Croissance",
  "app.nav.marketing": "Marketing",
  "app.nav.receptionist": "Réceptionniste",
  "app.nav.crewInbox": "Boîte équipe",
  "app.nav.refer": "Parrainage",

  "app.nav.help": "Aide",
  "app.nav.plan": "Forfait",
  "app.nav.settings": "Paramètres",
  "app.nav.logOut": "Déconnexion",

  "app.quickAdd.title": "Créer",
  "app.quickAdd.client": "Client",
  "app.quickAdd.request": "Demande",
  "app.quickAdd.quote": "Soumission",
  "app.quickAdd.job": "Chantier",
  "app.quickAdd.invoice": "Facture",

  "app.sidebar.collapse": "Réduire le menu",
  "app.sidebar.expand": "Agrandir le menu",
  "app.sidebar.openMenu": "Ouvrir le menu",
  "app.sidebar.closeMenu": "Fermer le menu",

  "app.action.save": "Enregistrer",
  "app.action.saving": "Enregistrement…",
  "app.action.saved": "Enregistré",
  "app.action.cancel": "Annuler",
  "app.action.delete": "Supprimer",
  "app.action.deleting": "Suppression…",
  "app.action.edit": "Modifier",
  "app.action.add": "Ajouter",
  "app.action.create": "Créer",
  "app.action.remove": "Retirer",
  "app.action.close": "Fermer",
  "app.action.back": "Retour",
  "app.action.next": "Suivant",
  "app.action.previous": "Précédent",
  "app.action.done": "Terminé",
  "app.action.confirm": "Confirmer",
  "app.action.search": "Rechercher",
  "app.action.filter": "Filtrer",
  "app.action.export": "Exporter",
  "app.action.download": "Télécharger",
  "app.action.upload": "Téléverser",
  "app.action.send": "Envoyer",
  "app.action.sending": "Envoi…",
  "app.action.duplicate": "Dupliquer",
  "app.action.archive": "Archiver",
  "app.action.restore": "Restaurer",
  "app.action.refresh": "Actualiser",
  "app.action.retry": "Réessayer",
  "app.action.viewAll": "Tout voir",
  "app.action.learnMore": "En savoir plus",
  "app.action.copyLink": "Copier le lien",
  "app.action.copied": "Copié",
  "app.action.print": "Imprimer",
  "app.action.preview": "Aperçu",
  "app.action.apply": "Appliquer",
  "app.action.clear": "Effacer",
  "app.action.selectAll": "Tout sélectionner",

  "app.state.loading": "Chargement…",
  "app.state.empty": "Rien pour l'instant",
  "app.state.noResults": "Aucun résultat",
  "app.state.error": "Une erreur est survenue",
  "app.state.required": "Obligatoire",
  "app.state.optional": "Facultatif",
  "app.state.unsaved": "Modifications non enregistrées",
  "app.state.comingSoon": "À venir",

  "app.status.draft": "Brouillon",
  "app.status.sent": "Envoyée",
  "app.status.viewed": "Consultée",
  "app.status.approved": "Acceptée",
  "app.status.declined": "Refusée",
  "app.status.expired": "Expirée",
  "app.status.paid": "Payée",
  "app.status.partiallyPaid": "Partiellement payée",
  "app.status.overdue": "En retard",
  "app.status.scheduled": "Planifié",
  "app.status.inProgress": "En cours",
  "app.status.completed": "Terminé",
  "app.status.cancelled": "Annulé",
  "app.status.pending": "En attente",
  "app.status.active": "Actif",
  "app.status.inactive": "Inactif",
  "app.status.new": "Nouveau",
  "app.status.won": "Gagnée",
  "app.status.lost": "Perdue",

  "app.time.today": "Aujourd'hui",
  "app.time.yesterday": "Hier",
  "app.time.tomorrow": "Demain",
  "app.time.thisWeek": "Cette semaine",
  "app.time.thisMonth": "Ce mois-ci",
  "app.time.thisYear": "Cette année",
  "app.time.lastWeek": "La semaine dernière",
  "app.time.lastMonth": "Le mois dernier",
  "app.time.allTime": "Depuis le début",
  "app.time.custom": "Période personnalisée",
  "app.time.hours": "heures",
  "app.time.minutes": "minutes",
  "app.time.days": "jours",

  "app.settings.title": "Paramètres",
  "app.settings.search": "Rechercher un réglage",

  "app.settings.group.account": "Compte",
  "app.settings.accountBilling": "Compte et facturation",
  "app.settings.refer": "Parrainage",
  "app.settings.productUpdates": "Nouveautés",

  "app.settings.group.business": "Entreprise",
  "app.settings.company": "Profil de l'entreprise",
  "app.settings.branding": "Image de marque",
  "app.settings.language": "Langue",

  "app.settings.group.team": "Équipe et horaires",
  "app.settings.team": "Gérer l'équipe",
  "app.settings.availability": "Disponibilités",
  "app.settings.leave": "Politiques de congés",
  "app.settings.bookingPage": "Page de rendez-vous",
  "app.settings.workAreas": "Zones desservies",

  "app.settings.group.pricing": "Services et tarifs",
  "app.settings.products": "Produits et services",
  "app.settings.services": "Services et tarifs",
  "app.settings.materials": "Matériaux",
  "app.settings.materialCosts": "Coût des matériaux",
  "app.settings.cabinetRates": "Tarifs des armoires",
  "app.settings.overhead": "Frais généraux",
  "app.settings.payroll": "Paie",
  "app.settings.customFields": "Champs personnalisés",

  "app.settings.group.documents": "Documents et communications",
  "app.settings.emailTemplates": "Modèles de courriel",
  "app.settings.pdfTemplates": "Modèles PDF",
  "app.settings.emailDomain": "Domaine d'envoi",
  "app.settings.translations": "Traductions",
  "app.settings.followUps": "Relances",
  "app.settings.notifications": "Notifications",
  "app.settings.checklists": "Listes de vérification",

  "app.settings.group.paid": "Encaissement",
  "app.settings.payments": "Paiements",
  "app.settings.expenseTracking": "Suivi des dépenses",

  "app.settings.group.clientFacing": "Côté client",
  "app.settings.website": "Votre site web",
  "app.settings.instantQuotes": "Soumissions instantanées",
  "app.settings.leadForm": "Partager vos liens",
  "app.settings.voice": "Réceptionniste téléphonique",
  "app.settings.reviews": "Avis",
  "app.settings.messages": "Messages aux clients",

  "app.settings.group.records": "Registres",
  "app.settings.activity": "Journal d'activité",

  "app.dash.title": "Tableau de bord",
  "app.dash.subtitle": "Voici où en est votre entreprise.",
  "app.dash.revenueThisMonth": "Revenus ce mois-ci",
  "app.dash.quotesSent": "Soumissions envoyées",
  "app.dash.conversionRate": "Taux de conversion",
  "app.dash.upcomingVisits": "Visites à venir",
  "app.dash.recentQuotes": "Soumissions récentes",
  "app.dash.upcomingAppointments": "Prochains rendez-vous",
  "app.dash.noQuotes": "Aucune soumission pour l'instant.",
  "app.dash.nothingScheduled": "Rien de prévu.",
  "app.dash.scheduleAppointment": "Planifier un rendez-vous",
  "app.dash.viewClients": "Voir les clients",

  "app.quotes.title": "Soumissions",
  "app.quotes.subtitle": "Gérez les soumissions de vos clients.",
  "app.quotes.new": "Nouvelle soumission",
  "app.quotes.search": "Rechercher une soumission...",
  "app.quotes.empty": "Créez votre première soumission",

  "app.jobs.title": "Chantiers",
  "app.jobs.subtitle": "Travaux planifiés et en cours.",
  "app.jobs.new": "Nouveau chantier",
  "app.jobs.search": "Rechercher un chantier...",
  "app.jobs.empty": "Aucun chantier dans cette vue.",
  "app.jobs.recurring": "Récurrent",

  "app.invoices.title": "Factures",
  "app.invoices.subtitle": "Suivez les paiements et la facturation.",
  "app.invoices.new": "Nouvelle facture",
  "app.invoices.search": "Rechercher une facture...",
  "app.invoices.totalBilled": "Total facturé",
  "app.invoices.outstanding": "Impayé",

  "app.clients.title": "Clients",
  "app.clients.new": "Nouveau client",
  "app.clients.import": "Importer",
  "app.clients.search": "Rechercher un client...",
  "app.clients.empty": "Ajoutez votre premier client",
  "app.clients.contractor": "Entrepreneur",

  // ── Champs de formulaire communs ──────────────────────────────────────────
  "app.field.name": "Nom",
  "app.field.phone": "Téléphone",
  "app.field.email": "Courriel",
  "app.field.address": "Adresse",
  "app.field.city": "Ville",
  "app.field.province": "Province",
  "app.field.notes": "Notes",

  // ── Formulaire nouveau client ─────────────────────────────────────────────
  "app.clientNew.back": "Retour aux clients",
  "app.clientNew.type": "Type de client",
  "app.clientNew.homeowner": "Particulier",
  "app.clientNew.homeownerHint": "Un particulier — les travaux ont lieu à son adresse",
  "app.clientNew.company": "Entreprise / Entrepreneur",
  "app.clientNew.companyHint": "Une entreprise — les chantiers varient d'un contrat à l'autre",
  "app.clientNew.companyName": "Nom de l'entreprise",
  "app.clientNew.contactPerson": "Personne-ressource",
  "app.clientNew.contactPlaceholder": "Votre interlocuteur sur place",
  "app.clientNew.businessAddress": "Adresse d'affaires (facultatif)",
  "app.clientNew.addressPlaceholder": "Commencez à taper une adresse...",
  "app.clientNew.businessAddressHint": "Il s'agit de leur bureau. L'adresse réelle de chaque chantier est définie sur la soumission ou le chantier.",
  "app.clientNew.nameRequired": "Le nom du client est obligatoire",
  "app.clientNew.createError": "Impossible de créer le client",
  "app.clientNew.creating": "Création...",
  "app.clientNew.create": "Créer le client",

  // ── Importer des clients (CSV) ────────────────────────────────────────────
  "app.clientImport.title": "Importer des clients",
  "app.clientImport.subtitle": "Téléversez un fichier CSV exporté d'un autre système. Colonnes attendues : name, email, phone, address, city, province.",
  "app.clientImport.readError": "Impossible de lire ce fichier — assurez-vous qu'il s'agit d'un CSV valide",
  "app.clientImport.failed": "Échec de l'importation",
  "app.clientImport.choose": "Cliquez pour choisir un fichier CSV",
  "app.clientImport.found": "{count} lignes trouvées. Aperçu des 3 premières :",
  "app.clientImport.noContact": "aucune coordonnée",
  "app.clientImport.importing": "Importation...",
  "app.clientImport.importN": "Importer {count} clients",
  "app.clientImport.imported": "{count} clients importés",
  "app.clientImport.skipped": " ({count} ignorés — nom manquant)",
  "app.clientImport.view": "Voir les clients",

  // ── Détail du client ──────────────────────────────────────────────────────
  "app.clientDetail.notFound": "Client introuvable.",
  "app.clientDetail.contactSuffix": "personne-ressource",
  "app.clientDetail.office": "bureau",
  "app.clientDetail.jobSitesVary": "Les chantiers varient pour les entrepreneurs — chaque soumission ou chantier porte sa propre adresse.",
  "app.clientDetail.companyDefaultLang": "Défaut de l'entreprise ({lang})",
  "app.clientDetail.docsEmails": "documents et courriels",
  "app.clientDetail.newQuote": "Nouvelle soumission",
  "app.clientDetail.newJob": "Nouveau chantier",
  "app.clientDetail.noQuotes": "Aucune soumission pour l'instant.",
  "app.clientDetail.noJobs": "Aucun chantier pour l'instant.",
  "app.clientDetail.noInvoices": "Aucune facture pour l'instant.",
  "app.clientDetail.edit": "Modifier le client",
  "app.clientDetail.saveChanges": "Enregistrer",
  "app.clientDetail.langHint": "Les soumissions, factures et courriels sont envoyés dans cette langue.",
  "app.clientDetail.saveError": "Impossible d'enregistrer",
  "app.clientDetail.quoteFallback": "Soumission",
  "app.clientDetail.invoiceFallback": "Facture",

  "app.leads.title": "Prospects",
  "app.leads.subtitle": "Demandes reçues de votre page de rendez-vous et de vos formulaires.",
  "app.leads.empty": "Aucune demande pour l'instant",
  "app.leads.emptyHint": "Les demandes arrivent ici lorsqu'une personne remplit votre page de rendez-vous publique.",
  "app.leads.startQuote": "Créer une soumission",
  "app.leads.nothingHere": "Rien ici",

  "app.appts.title": "Rendez-vous",
  "app.appts.subtitle": "Visites sur place et affectations de chantier.",
  "app.appts.new": "Nouveau rendez-vous",
  "app.appts.empty": "Aucun rendez-vous dans cette vue.",
  "app.appts.clientName": "Nom du client",
  "app.appts.dateTime": "Date et heure",
  "app.appts.location": "Lieu",
  "app.appts.siteAddress": "Adresse du chantier",
  "app.appts.assignTo": "Assigner à",
  "app.appts.unassigned": "Non assigné",
  "app.appts.supervisorRequired": "Superviseur requis",
  "app.appts.supervisorHint": "Exige la présence d'un superviseur sur place",

  "app.timeOff.title": "Congés",
  "app.timeOff.subtitle": "Demandez des congés et voyez ce qu'il vous reste.",
  "app.timeOff.request": "Demander un congé",
  "app.timeOff.mine": "Les miens",
  "app.timeOff.yourRequests": "Vos demandes",
  "app.timeOff.awaitingApproval": "En attente d'approbation",
  "app.timeOff.nothingToApprove": "Rien à approuver.",
  "app.timeOff.noneUpcoming": "Aucun congé approuvé à venir.",
  "app.timeOff.viewOnly": "Vous pouvez consulter les demandes, mais pas les approuver.",
  "app.timeOff.balances": "Soldes de l'année",
  "app.timeOff.noBalance": "Aucun solde accumulé cette année.",
  "app.timeOff.accrued": "Accumulé",
  "app.timeOff.taken": "Pris",
  "app.timeOff.left": "Restant",
  "app.timeOff.policy": "Politique",
  "app.timeOff.person": "Personne",
  "app.timeOff.type": "Type",
  "app.timeOff.firstDay": "Premier jour",
  "app.timeOff.lastDay": "Dernier jour",
  "app.timeOff.halfDayOnly": "Demi-journée seulement",
  "app.timeOff.note": "Note (facultatif)",
  "app.timeOff.notePlaceholder": "Ce que votre gestionnaire devrait savoir",
  "app.timeOff.earlier": "Plus tôt",

  "app.schedule.title": "Horaire de l'équipe",
  "app.schedule.nextTwoWeeks": "Prochaines 2 semaines",
  "app.schedule.noAvailability": "Aucune disponibilité définie",
  "app.schedule.noMembers": "Aucun membre d'équipe pour l'instant.",

  "app.payroll.title": "Paie",
  "app.payroll.runs": "Périodes de paie",
  "app.payroll.newRun": "Nouvelle période de paie",
  "app.payroll.saveDraft": "Enregistrer comme brouillon",
  "app.payroll.noRuns": "Aucune période de paie pour l'instant.",
  "app.payroll.myEarnings": "Ma rémunération",
  "app.payroll.noPayslips": "Aucun bulletin de paie. Ils apparaissent une fois la période approuvée.",
  "app.payroll.ownPayslipsOnly": "Seuls vos propres bulletins de paie sont accessibles depuis votre compte.",
  "app.payroll.nothingApproved": "Aucune heure ni aucun salaire approuvé pour cette période.",
  "app.payroll.periodStart": "Début de la période",
  "app.payroll.periodEnd": "Fin de la période",
  "app.payroll.frequency": "Fréquence",
  "app.payroll.payslipLabels": "Libellés du bulletin",
  "app.payroll.downloadPayslip": "Télécharger ce bulletin en PDF",
  "app.payroll.payYourself": "Vous payez par votre propre banque ou service de paie",

  "app.activity.title": "Journal d'activité",
  "app.activity.empty": "Aucune activité enregistrée.",

  "app.help.title": "Centre d'aide",

  "app.reviews.title": "Révision des estimations",
  "app.reviews.empty": "Rien en attente. Les nouvelles estimations instantanées de votre site apparaîtront ici.",
  "app.reviews.supervisorOnly": "Seul un superviseur, un administrateur ou le propriétaire peut approuver.",
  "app.reviews.openQuote": "Ouvrir la soumission",
  "app.reviews.approveAt": "Approuver à",
  "app.reviews.property": "Propriété",
  "app.reviews.material": "Matériau :",

  "app.job.backToJobs": "Retour aux chantiers",
  "app.job.client": "Client",
  "app.job.visits": "Visites",
  "app.job.addVisit": "Ajouter une visite",
  "app.job.noVisits": "Aucune visite planifiée. Ajoutez-en une pour placer ce chantier au calendrier.",

  "app.timesheets.title": "Feuilles de temps",
  "app.timesheets.subtitle": "Révisez et approuvez les heures déclarées.",
  "app.timesheets.empty": "Aucune entrée de temps.",
  "app.timesheets.approve": "Approuver",
};

export const APP_MESSAGES = { en, fr };

/** Every app key that exists in English. */
export const APP_MESSAGE_KEYS = Object.keys(en);

/**
 * How much of the INTERFACE is translated into a language, 0–1.
 *
 * Printed on the language settings page rather than kept internal. A picker
 * that offers six languages while four of them render an English interface is
 * a control that appears to work and doesn't; one that says "interface 100% /
 * 0%" is a control that tells the truth.
 */
export function appCoverage(code) {
  if (code === "en") return 1;
  const dict = APP_MESSAGES[code];
  if (!dict) return 0;
  const covered = APP_MESSAGE_KEYS.filter((k) => k in dict).length;
  return covered / APP_MESSAGE_KEYS.length;
}

/** Languages whose interface catalogue is complete. */
export const APP_LANGUAGES = Object.keys(APP_MESSAGES).filter(
  (code) => appCoverage(code) === 1,
);
