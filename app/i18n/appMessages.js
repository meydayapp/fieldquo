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
  "app.nav.requests": "Requests",
  "app.nav.quotes": "Quotes",
  "app.nav.estimateReviews": "Estimate Reviews",
  "app.nav.jobs": "Jobs",
  "app.nav.invoices": "Invoices",
  "app.nav.calendar": "Calendar",

  "app.nav.group.people": "People",
  "app.nav.clients": "Clients",
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

  "app.settings.group.records": "Records",
  "app.settings.activity": "Activity Log",
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
  "app.nav.requests": "Demandes",
  "app.nav.quotes": "Soumissions",
  "app.nav.estimateReviews": "Révision des estimations",
  "app.nav.jobs": "Chantiers",
  "app.nav.invoices": "Factures",
  "app.nav.calendar": "Calendrier",

  "app.nav.group.people": "Personnel",
  "app.nav.clients": "Clients",
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

  "app.settings.group.records": "Registres",
  "app.settings.activity": "Journal d'activité",
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
