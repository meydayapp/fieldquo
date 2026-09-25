// lib/i18n/clientDocCopy.js
//
// The page-specific sentences on the two interactive client surfaces — the
// public quote-approval page (/q/[token]) and the client portal (/portal) —
// in every language FieldQuo has document copy for. That is a superset of the
// picker: de and it are complete here and in the other three document tables,
// waiting on app/i18n/languages.js. See check-language-completeness.mjs.
//
// ── Why this is separate from everything else ───────────────────────────────
//
// documentLabels.js already covers the fixed furniture a quote and an invoice
// share (Subtotal, Tax, Total, Prepared for…), and those get reused here. What
// documentLabels does NOT cover is the interactive chrome that only exists on
// these two React pages: "Approve this quote", the signature consent line, the
// portal's "Balance owing". Those aren't part of a printed document, so they
// don't belong in documentLabels; but they're read by a homeowner, not staff,
// so they don't belong in app/i18n/appMessages.js either. This is their home.
//
// ── Hand-written, like documentLabels ───────────────────────────────────────
//
// A closed set of short transactional strings, translated by hand rather than
// drafted by a model. The signature-consent line is legally operative — it is
// the sentence a client ticks to turn a drawn mark into a binding approval —
// so it is translated faithfully and kept plain, never abbreviated.
//
// Functions where a name, amount or date is interpolated: word order around a
// value differs by language, and "Approve this quote for $X?" cannot be built
// by concatenation that survives translation.

const COPY = {
  en: {
    // "See the property" on /q/[token] — app/components/StreetViewPeek.js.
    streetView: { see: "See the property", hide: "Hide", openInMaps: "Open in Google Maps", frameTitle: "Street View of the property" },
    portalDocumentsHeading: "Documents",

    // ── /q/[token] — the proposal beside the quote ─────────────────────────
    proposal: {
      contents: "Contents",
      yourProject: "Your project",
      aboutUs: "About us",
      beforeAfter: "Before & after",
      importantDocuments: "Important documents",
      testimonials: "Testimonials",
      services: "Services",
      scopeOfWork: "Scope of work",
      priceByArea: "Price by area",
      quoteTotal: "Quote total",
      acceptQuote: "Accept quote",
      day: (n) => `Day ${n}`,
      crewOf: (n) => `Crew of ${n}`,
      halfDay: "Half day",
      paintLine: (products, coats) =>
        products && coats ? `Paint: ${products} · ${coats}` : products ? `Paint: ${products}` : coats,
      coats: (n) => (n === 1 ? "1 coat" : `${n} coats`),
      viewDocument: "View document →",
      before: "Before",
      after: "After",
      recentWork: "Recent work",
      documentsHeading: "Certificates and documents",
      whatClientsSaid: "What clients said",
      whatElseWeDo: "What else we do",
      watchVideo: "Watch our intro video",
      teamPhotoAlt: "Our team",
    },
    // ── /estimate-report/[token] — the instant estimate as a proposal ─────
    // The same presentation as the quote, with the RANGE where the prices
    // would be (app/estimate-report/[token]/ReportView.js).
    rangeProposal: {
      yourEstimate: "Your estimate",
      estimateWord: "Estimate",
      estimatedRange: "Estimated range",
      subjectToVisit: "Estimate — subject to a site visit",
      rangeFor: (option) => `For: ${option}`,
      rangeNote: (company) => `Based on the details you gave us. ${company} confirms the final price after seeing the job in person — nothing is binding until you approve a quote.`,
      noRange: (company) => `${company} will confirm your price after a site visit.`,
      whatHappensNext: "What happens next",
      bookVisit: "Book your site visit",
      talkToUs: "Talk to us",
    },
    // ── Waivers (/w/[token] and inside the proposal) ───────────────────────
    waiverKicker: "Waiver",
    waiverAttachedTo: (ref) => `Attached to ${ref}`,
    waiverIntro: "Please read each section and tick that you understand it. Signing is at the end.",
    waiverAcknowledgements: "Acknowledgements",
    waiverSign: "Sign",
    waiverAcknowledged: (n, total) => `${n} of ${total} acknowledged`,
    signWaiver: "Sign waiver",
    waiverTickRemaining: (n) =>
      n === 1 ? "Tick the remaining acknowledgement to unlock signing." : `Tick the remaining ${n} acknowledgements to unlock signing.`,
    waiverConsent: "I agree that signing here is my electronic signature and that I have read and accept this waiver.",
    waiverSignedTitle: "Waiver signed — thank you",
    waiverSignedBody: (company) => `A copy has been sent to you and filed with ${company}.`,
    waiverSignedOn: (date) => `Signed ${date}`,
    waiverSignedBy: (name, date) => `Signed by ${name} on ${date}`,
    waiverAfterNote: "Once signed, a copy with the date, your name and each acknowledgement is sent to you and filed on this job. The quote itself is signed separately.",
    waiverRequiredBeforeApprove: "Sign the attached waiver before approving this quote.",
    waiverCopyIntro: (company) => `Your signed copy of the waiver for ${company} is attached.`,
    waiverLinkIntro: (company, title) => `${company} has a document for you to read and sign: "${title}". It takes a minute.`,
    waiverOpen: "Read and sign",
    // /q/[token] — quote approval
    approveThisQuote: "Approve this quote",
    decline: "Decline",
    whatsIncluded: "What's included",
    whatCouldChange: "What could change this price",
    termsExplained: "The terms on this quote, explained",
    optionalExtras: "Optional extras",
    extrasTickHint:
      "Tick anything you'd like added. The total updates as you go — nothing is charged until you approve.",
    extrasChosen: "Chosen when this quote was approved.",
    includesOptionalExtras: "Includes optional extras",
    payOfflineHint: "You will pay by e-transfer or cheque instead of by card.",
    howTheWorkRuns: "How the work runs",
    paymentTerms: "Payment terms",
    yourFullName: "Your full name",
    typeYourName: "Type your name",
    signature: "Signature",
    signatureConsent: (total) =>
      `I agree that signing here is my electronic signature and approves this quote for ${total}.`,
    approveConfirm: (total) => `Approve this quote for ${total}?`,
    declineConfirm: "Decline this quote?",
    approveSubExtras: (extras) =>
      `Including ${extras} of optional extras. This tells them to go ahead.`,
    approveSubPlain: "This tells them to go ahead.",
    declineSub: "You can always ask for a revised quote.",
    yesApprove: "Yes, approve",
    yesDecline: "Yes, decline",
    goBack: "Go back",
    approvedTitle: "Approved — thank you",
    approvedBody: (company) =>
      `${company} has been notified and will be in touch about next steps.`,
    declinedTitle: "Quote declined",
    declinedBody: (company) =>
      `${company} has been notified. If this was a mistake, give them a call.`,
    expiredTitle: "This quote has expired",
    expiredBody: (company) => `Contact ${company} for an updated price.`,
    // Covering note on the signed-quote PDF emailed to the client after they
    // approve. Short: the PDF is the document, this note just says why it landed.
    approvedCopyIntro: (company) =>
      `Thank you for approving your quote with ${company}. A copy is attached for your records.`,
    // Under the satellite still on a quote: where the measurement was taken,
    // which is the job site and often not the billing address on the header.
    // Interpolated because the address goes at the END in every language here
    // but a translator may need it elsewhere.
    measuredAt: (address) => `Measured at ${address}`,
    genericError: "Something went wrong. Try again.",

    // ── The two ways this page can fail to load ─────────────────────────
    //
    // A refused request has a sentence from the server worth showing; a
    // dropped one has nothing but a browser exception, and this page's
    // audience is a homeowner on a phone in a driveway, so the dropped
    // request is the likelier of the two. It gets its own words and a way
    // back — see QuoteApproval's load effect.
    connectionLost: "We couldn't load your quote.",
    connectionLostHint:
      "You may have lost signal. Check your connection and try again — nothing has been sent.",
    tryAgain: "Try again",
    linkInvalidHint:
      "Get in touch with the company that sent it and they can send a fresh link.",

    // ── Financing ────────────────────────────────────────────────────────────
    //
    // The monthly figure only ever appears when the COMPANY has stated an APR
    // and a term (lib/financing/monthlyEstimate.js). Which is why the note is
    // worded the way it is and must not be shortened: it names whose terms
    // these are, says the figure is an estimate, and hands the real quoting job
    // to the provider. Drop any one of those three and it reads as a promise
    // the contractor never made.
    financingAvailable: "Financing",
    financingHeading: "Pay monthly",
    financingMonthly: (monthly) => `About ${monthly} a month`,
    financingTermsLine: (months, apr) =>
      `Estimated over ${months} months at ${apr} APR.`,
    financingEstimateNote: (company) =>
      `An estimate only, on the terms ${company} has stated, based on the total above. Your finance provider quotes the actual rate, payment and approval when you apply.`,
    financingCta: "See financing options",
    quoteQuestions: (company, phone) =>
      phone
        ? `Questions? Reply to the email, or call ${company} at ${phone}.`
        : `Questions? Reply to the email, or call ${company}.`,

    // /portal/[token] — account overview
    accountFor: (name) => `Account for ${name}`,
    balanceOwing: "Balance owing",
    nothingOutstanding: "Nothing outstanding. Thank you.",
    acrossInvoices: (n) => `Across ${n} invoice${n === 1 ? "" : "s"}.`,
    invoicesHeading: "Invoices",
    quotesHeading: "Quotes",
    paidNote: (amount) => `${amount} paid`,
    dueNote: (date) => `due ${date}`,
    pay: (amount) => `Pay ${amount}`,
    paid: "Paid",
    review: "Review",
    // ── The quote pill, in words a homeowner uses ──────────────────────────
    //
    // The portal printed `Quote.status` straight through with a `capitalize`
    // class on it, so a French client's account listed "Accepted" under
    // "Soumissions" — the raw database enum, in English, on the one screen the
    // whole portal is translated for.
    //
    // Written from the CLIENT's side, not the office's. `sent` is a fact about
    // what the contractor did; what it means to the person reading is that the
    // next move is theirs, and that is what the pill says. Keyed by the enum so
    // scripts/check-tenant-surfaces.mjs can hold this map against
    // prisma/schema.prisma — `draft` is here for that completeness alone, since
    // app/api/portal/[token]/route.js filters drafts out before they can be
    // listed.
    quoteStatus: {
      draft: "Draft",
      sent: "Awaiting your reply",
      accepted: "Approved",
      declined: "Declined",
    },
    paymentReceived:
      "Payment received — thank you. It can take a minute to show below.",
    // ── Paying from a bank account (pre-authorized debit / ACH) ─────────
    //
    // Offered beside the card button only when the company's Stripe account
    // has the capability active (lib/stripe/bankDebit.js). A bank debit is
    // not "received" on return — it clears in 3–5 business days — so the
    // portal has its own sentences for pending and failed, never the card
    // one.
    payCard: (amount) => `Pay ${amount} by card`,
    payBank: (amount) => `Pay ${amount} from bank account`,
    bankNote: "Bank payments take 3–5 business days to clear. Until then the invoice shows as pending.",
    bankPendingBanner: "Bank payment received — it takes 3–5 business days to clear. The invoice will show as paid once it has.",
    bankPending: "Bank payment pending",
    bankFailed: (reason) => `Bank payment failed${reason ? ` — ${reason}` : ""}. You can try again or pay by card.`,
    // Stripe caps one pre-authorized debit at $3,000 CAD (measured —
    // lib/stripe/bankDebit.js). Above it the bank button is absent and this
    // says why, so the missing option reads as a rule, not a fault.
    bankOverCap: (max, amount) => `Bank debit is available up to ${max} per payment — this invoice is ${amount}, so it's card only.`,
    // Stripe refused to open the payment page. Their wording never reaches
    // the homeowner; the office gets the detail on /platform/errors.
    paymentNotStarted: (company) => `This payment couldn't be started — please try by card, or contact ${company}.`,
    portalQuestions: (company, phone, email) =>
      `Questions about any of this? Contact ${company}${phone ? ` at ${phone}` : ""}${email ? ` · ${email}` : ""}.`,

    // /portal/[token]/invoices/[id]
    backToAccount: "Back to your account",
    due: "Due",
    wasDue: "Was due",
    noItemisedBreakdown: "No itemised breakdown on this invoice.",
    paidInFull: "Paid in full",
    paidInFullThanks: "Paid in full — thank you",
    invoiceNotFound: "That invoice isn't on your account.",
    // Shown INSTEAD of the Pay button when the company hasn't finished
    // connecting Stripe. Same two sentences the invoice email already sends in
    // that case (emailCopy.arrangePayment / accepted), so a client who reads the
    // email and then opens the portal is told the same thing twice, not two
    // different things.
    arrangePayment: "Please get in touch to arrange payment.",
    acceptedMethods: (methods) => `Accepted: ${methods}.`,

    // /quote/[companySlug] — the public self-quote form and its confirmation.
    //
    // The form used to hold these inline in English, which is why a homeowner
    // offered a language choice would have switched the confirmation and left
    // the three steps before it untranslated. A document is written in ONE
    // language (AGENTS.md non-negotiable 6), and the form that creates it is
    // part of that document's making.
    //
    // "Request", not "Quote", on the masthead: nobody has priced anything yet,
    // and a confirmation headed QUOTE implies a figure exists.
    // /portal — the job progress card (app/portal/[token]/JobProgressCard.js).
    //
    // The client hears from a job: what is done, what the crew is on, what is
    // waiting and on whom. Never a price per step, never an internal note —
    // the route allow-lists the fields (app/api/portal/[token]/route.js).
    // The portal's plans and visits (app/portal/[token]/PlansAndVisits.js),
    // the reschedule / skip request, and the "Client login" email
    // (lib/portal/loginEmail.js).
    portal: {
      nextVisitKicker: "Next visit",
      planKicker: "Your plan",
      upcomingHeading: "Upcoming visits",
      pastHeading: "Past visits",
      between: (from, to) => `between ${from} and ${to}`,
      at: (time) => `at ${time}`,
      withCrew: (name) => `with ${name}`,
      typeVisit: "Visit",
      typeReturn: "Return visit",
      typeAppointment: "Appointment",
      typeCall: "Phone call",
      typeVideo: "Video call",
      frequency: {
        weekly: "Every week",
        monthly: "Every month",
        quarterly: "Every 3 months",
        semiannual: "Twice a year",
        annual: "Once a year",
      },
      perVisit: (amount) => `${amount} per visit`,
      taxIncluded: "tax included",
      memberDiscount: (pct) => `Includes your ${pct}% plan discount`,
      included: "What's included",
      nextDates: "Next dates",
      endsOn: (date) => `Plan runs until ${date}`,
      visitsSold: (n) => (n === 1 ? "1 visit in this plan" : `${n} visits in this plan`),
      reschedule: "Request to reschedule",
      skip: "Skip this visit",
      rescheduleQuestion: "What would work better for you?",
      skipQuestion: "Anything we should know? (optional)",
      requestPlaceholder: "For example: any weekday after the 20th",
      requestExplain: (company) => `${company} will get back to you. Nothing changes until they confirm.`,
      requestSend: "Send request",
      cancel: "Cancel",
      requested: "Request sent",
      requestTooLate: "This visit is too close to change here. Please call instead.",
      requestFailed: "Your request couldn't be sent. Please try again, or call.",
      callToChange: "Less than a day away. Call to change it.",
      photoAlt: "Photo from this visit",
      loginEmailSubject: (company) => `Your account with ${company}`,
      loginEmailLabel: "Your account",
      loginEmailGreeting: (first) => (first ? `Hi ${first},` : "Hello,"),
      loginEmailIntro: (company) => `Here is the link to your account with ${company}: your quotes, invoices, visits and plans in one place.`,
      loginEmailButton: "Open your account",
      loginEmailKeep: "This link is personal to you. Keep it to yourself, and bookmark it to come back any time.",
      loginEmailIgnore: "If you didn't ask for this link, you can ignore this email. Nothing on your account has changed.",
      // Server-built wording for requests the client files (lib/portal/
      // changeRequest.js, the portal tickets route) and the reply email.
      rescheduleSubject: (what, date) => `Move ${what} on ${date}`,
      skipSubject: (what, date) => `Skip ${what} on ${date}`,
      requestNoMessage: "No message — please suggest another date.",
      maintenanceSubject: (plan) => `Book my next visit — ${plan}`,
      preferredLine: (when) => `When suits me: ${when}`,
      maintenanceNoNote: "Please suggest a date for my next included visit.",
      ticketReplySubject: (subject) => `Re: ${subject}`,
      ticketReplyIntro: (who, subject) => `${who} replied about “${subject}”:`,
      ticketReplyButton: "View and reply",
      ticketEmailLabel: "Your request",
      tickets: {
        heading: "Your requests",
        reportIssue: "Report an issue",
        requestWork: "Request work",
        reportOnVisit: "Report an issue",
        reportTitle: "Report an issue",
        aboutVisit: (date) => `About the visit on ${date}`,
        typeLabel: "What is it about?",
        types: {
          repair: "Something needs fixing",
          warranty: "Warranty claim",
          question: "A question",
          billing: "Billing",
          reschedule: "Change a date",
          maintenance: "Maintenance visit",
        },
        subjectLabel: "Short summary",
        bodyLabel: "Tell us what's happening",
        photosLabel: "Photos (optional)",
        addPhoto: "Add a photo",
        uploading: "Uploading…",
        uploadFailed: "That photo couldn't be uploaded.",
        send: "Send",
        cancel: "Cancel",
        sent: (company) => `Sent. ${company} will reply here and by email.`,
        failed: "That couldn't be sent. Please try again.",
        status: {
          open: "Received",
          in_progress: "In progress",
          waiting_on_client: "Waiting on you",
          resolved: "Resolved",
          closed: "Closed",
        },
        you: "You",
        replyPlaceholder: "Write a reply…",
        sendReply: "Send reply",
        closedNote: "This request is closed. Report a new issue if something else comes up.",
        workTitle: "Request work",
        workNewJob: "A new job or quote",
        workMaintenance: "A maintenance visit",
        workService: "Which service?",
        workServiceOther: "Something else",
        workDescribe: "Describe the work",
        workDates: "Preferred dates (optional)",
        workDatesPlaceholder: "For example: any weekday in early November",
        workSent: (company) => `Sent. ${company} will get back to you to confirm. Nothing is booked or charged until they do.`,
        workPlan: "Which plan?",
        workRemaining: (n) => (n === 1 ? "1 included visit left" : `${n} included visits left`),
        workUntilCancelled: "Visits continue until the plan ends",
        workWindow: "When suits you?",
        workWindowPlaceholder: "For example: mornings, the week of the 10th",
        workNote: "Anything else? (optional)",
        workSetupIntro: (company) => `You don't have a maintenance plan yet. Tell ${company} what you'd like looked after regularly and how often, and they'll come back with options.`,
        workSetupDescribe: "What should be looked after, and how often?",
        workConfirmNote: (company) => `${company} confirms everything before it is booked. Nothing is scheduled or charged from here.`,
      },
    },

    job: {
      kicker: "Your job",
      dayOf: (day, total) => `Day ${day} of ${total}`,
      onSchedule: "on schedule",
      runningLate: "running behind",
      finished: "Finished",
      started: (date) => `Started ${date}`,
      finishPlanned: (date) => `Finish planned ${date}`,
      datesToConfirm: "Dates to be confirmed",
      done: "Done",
      inProgress: "In progress",
      waitingOn: "Waiting on",
      upNext: "Up next",
      photos: (n) => (n === 1 ? "1 photo" : `${n} photos`),
      onSiteSince: (names, time) => `${names} on site since ${time}`,
      photoAdded: (time) => `Photo added ${time}`,
      today: "Today",
      waitingOnStep: (title) => `Waiting on ${title}`,
      waitingOnExternal: (reason) => `Waiting on ${reason}`,
      waitingOnApproval: (label) => `Waiting on your approval of change order ${label}`,
      waitingOnYou: "Waiting on you",
      reviewAndSign: "Review and sign",
      datesNote: "Dates are the crew's plan and can move.",
      changesHeading: "Changes awaiting your approval",
      approvedChange: (label, date) => `${label} approved ${date}`,
      stepsDone: (done, total) => `${done} of ${total} steps done`,
    },

    // /co/[token] — the change-order addendum, its email and its text.
    changeOrder: {
      kicker: "Change order",
      toQuote: (number) => `to quote ${number}`,
      forClient: (name) => `For ${name}`,
      originalLine: "Original line",
      theChange: "The change",
      photo: (when) => `Photo · ${when}`,
      quoteTotalAsApproved: (date) => (date ? `Quote total as approved ${date}` : "Quote total as approved"),
      priorChanges: "Changes already approved",
      thisChange: "This change",
      taxOnChange: (rate) => `${rate} tax on the change`,
      taxUnknown: "Tax on this change is not shown here; your invoice will state it at the quote's rate.",
      newTotal: "New total",
      schedule: "Schedule",
      finishMoves: (from, to, days) => `Finish moves from ${from} to ${to} (${days})`,
      finishMovesBy: (days) => `Finish moves by ${days}`,
      days: (n) => (n === 1 || n === -1 ? `${n > 0 ? "+" : "−"}1 day` : `${n > 0 ? "+" : "−"}${Math.abs(n)} days`),
      scheduleUnchanged: "No change to the schedule",
      consent: (amount, total) => `I approve this change for ${amount} including tax, making the new total ${total}.`,
      consentSchedule: (days) => ` I also approve the schedule change (${days}).`,
      approveAndSign: "Approve & sign",
      askQuestion: "Ask a question",
      footer: (company, phone) => `The original quote you signed is unchanged; this addendum is added to it. Questions? Reply to the text, or call ${company}${phone ? ` at ${phone}` : ""}.`,
      approvedTitle: "Approved — thank you",
      approvedBody: (company) => `${company} has your signed approval and will carry on with the change.`,
      approvedOn: (date) => `Approved ${date}.`,
      withdrawnTitle: "This change was withdrawn",
      withdrawnBody: (company) => `${company} withdrew this change order. Nothing changes on your quote.`,
      notFound: "This link isn't valid.",
      notFoundBody: "Get in touch with the company you're working with and they can send a fresh one.",
      signFailed: "Couldn't record your approval just now. Try again in a moment.",
      // The covering email and the text message.
      emailSubject: (label, company) => `${label} from ${company} — please review and sign`,
      emailIntro: (name, label, number) => `Hi ${name}, there's a change to your job (${label}${number ? `, to quote ${number}` : ""}) that needs your approval before the work carries on.`,
      emailButton: "Review and sign",
      emailFooter: "Nothing changes on your quote or invoice until you sign.",
      smsText: (company, label, url) => `${company}: change order ${label} for your job needs your approval — review and sign here: ${url}`,
    },

    selfQuote: {
      documentWord: "Request",
      eyebrow: "Request a quote",
      languageLabel: "Language",

      step1Title: "What can we help with?",
      step1Hint: "Pick the closest match — we'll sort out the detail.",
      noServices: (phone) =>
        `This company hasn't set up their services yet. Get in touch with them directly${phone ? ` on ${phone}` : ""}.`,

      step2Hint: "Rough numbers are fine — nothing here is binding.",
      designKitchen: "Prefer to draw it? Design your kitchen yourself and send us the layout →",
      timelineLabel: "When are you hoping to start?",
      timelineAsap: "As soon as possible",
      timeline2Weeks: "Within 2 weeks",
      timeline1To3Months: "In the next 1–3 months",
      timelineExploring: "Just exploring for now",
      budgetLabel: "Rough budget?",
      optional: "(optional)",
      budgetUnder: (s) => `Under ${s}1,000`,
      budgetLow: (s) => `${s}1,000 – ${s}5,000`,
      budgetMid: (s) => `${s}5,000 – ${s}15,000`,
      budgetHigh: (s) => `${s}15,000+`,
      budgetUnsure: "Not sure yet",
      notesLabel: "Anything else we should know?",
      notesPlaceholder: "Photos, timing, access, anything unusual…",
      continueCta: "Continue",

      step3Title: "Where should we send it?",
      step3Hint: "One of email or phone is enough.",
      namePlaceholder: "Your name",
      emailPlaceholder: "Email",
      phonePlaceholder: "Phone",
      addressPlaceholder: "Where's the job?",
      errAddress: "Please tell us the job address.",

      // The upload control on step 3. Named PDF-first for the trade that asked
      // for it: a cabinet client almost always has an IKEA planner PDF and,
      // until the form said so, no idea they could send it.
      uploadLabel: "Add photos, a video or a PDF plan",
      uploadHint:
        "A picture, short clip or your PDF plan helps us quote accurately.",
      uploadDocumentFallback: "PDF plan",
      // The rest of MediaUploader's own strings. They used to be hardcoded
      // English inside the shared component, so a homeowner on a French form
      // got 'Uploading…' and an English connection error — on the one surface
      // where a bad connection is the likeliest thing to happen.
      uploadBusy: "Uploading…",
      uploadLimit: (n) => `You can attach up to ${n} files.`,
      uploadFailed:
        "Upload failed — check your connection and try again.",
      uploadRejected: "That file couldn't be uploaded.",
      // The refusal the server never gets to explain: Vercel answers 413 at
      // the edge for a body over the request cap and puts no JSON in it, so
      // this sentence is composed in the browser. Both numbers, because "too
      // large" alone leaves somebody guessing how much to shrink it by.
      uploadTooLarge: (size, limit) => `That file is ${size} — the most that can be sent in one upload is ${limit}. Take the photo at a smaller size, or resize it and try again.`,
      uploadRemove: "Remove",
      back: "Back",
      sendCta: "Send my request",
      noObligation: (company) =>
        `No obligation. ${company} will get back to you with a price.`,

      errName: "Please tell us your name.",
      errContact: "Add an email or a phone number so we can reply.",
      errSend: "Couldn't send your request.",
      linkInvalid: "This link isn't valid.",
      linkInvalidHint:
        "Check the link, or get in touch with the company directly.",

      confirmTitle: "Request received",
      confirmIntro: (company) =>
        `${company} has everything below and will be in touch with a price.`,
      requestedHeading: "What you asked for",
      nextHeading: "What happens next",
      next1Title: "They read it",
      next1Body:
        "Your answers land with the company straight away, along with anything you attached.",
      next2Title: "They price it",
      next2Body:
        "A person works out the real cost for your job — nothing here was priced automatically.",
      next3Title: "You get a quote",
      next3Body:
        "It arrives as a document you can read, question and approve. Nothing is agreed until you do.",
      estimateLabel: "Estimated range",
      beforeTax: "before tax",
      gatedNote:
        "No price is shown yet — this request hasn't been priced. That's deliberate: the figure you get will be one a person stands behind.",
      submittedLabel: "Submitted",
      copySentTo: (email) => `A copy is on its way to ${email}.`,
      callInstead: "Need it sooner?",
      // The in-person visit offered under the confirmation. Only rendered when
      // the company can actually take a booking — see lib/booking/canBookVisit.js.
      bookVisitTitle: "Would you like us to come and see it?",
      bookVisitBody:
        "Book an in-person visit and we'll confirm your price on site.",
      bookVisitCta: "Book a visit",

      emailSubject: (company) => `Your request to ${company}`,
      emailIntro: (company) =>
        `Thanks — ${company} has your request. Here's what you sent, for your records.`,
    },

    // /visit/[token] — the visit a homeowner already has booked.
    //
    // Two sentences on this screen do real work and the rest is furniture:
    //
    //   cannotTooLate  — a refusal that states the notice the company asked
    //                    for. "You can't change this" with no number reads as
    //                    a broken button; "they need 24 hours' notice" reads
    //                    as a policy, and tells them what to do instead.
    //   refundYes/No   — what happens to money already taken. These are worded
    //                    apart on purpose and neither is a default: refundNo
    //                    never says "non-refundable" (the contractor may well
    //                    refund it by hand) and refundYes is only ever shown
    //                    when the policy will actually make the refund.
    //
    // noticeHours is its own function because the plural rule is per-language
    // and Ukrainian has three forms — a template with "hours" baked in cannot
    // be translated correctly, only translated badly.
    visit: {
      eyebrow: "Your visit",
      loadFailed: "We couldn't load your visit.",
      loadFailedHint:
        "Check the link in your email, or get in touch with the company directly.",

      aboutEstimate: (number) => `About your estimate ${number}`,

      whenLabel: "When",
      whereLabel: "Where",
      modeVisit: "We're coming to you",
      modeCall: "Phone call — we'll ring you",
      modeVideo: "Video call — we'll email a link",
      addressUnknown: "Address to be confirmed",
      depositPaid: (amount) => `${amount} deposit paid`,

      changeHeading: "Need to change something?",
      rescheduleCta: "Change the time",
      cancelCta: "Cancel this visit",

      cannotCancelled: "This visit has already been cancelled.",
      cannotHappened: "This visit has already taken place.",
      cannotAwaitingPayment:
        "This visit isn't confirmed yet — the payment hasn't come through.",
      cannotNotFound: "This link doesn't match a visit.",
      cannotTooLate: (notice, company) =>
        `${company} asks for at least ${notice} notice, so this visit can't be changed here any more.`,
      cannotTooLateNoNotice: (company) =>
        `It's now too close to your appointment for ${company} to take a change here.`,
      noticeHours: (n) => (n === 1 ? "1 hour's" : `${n} hours'`),
      callInstead: (company, phone) =>
        phone
          ? `Call ${company} on ${phone} — they can still move it for you.`
          : `Get in touch with ${company} — they can still move it for you.`,

      refundYes: (amount) =>
        `Your ${amount} deposit will be returned to the card you paid with.`,
      refundNo: (amount) =>
        `Your ${amount} deposit is not automatically returned — get in touch with them about it.`,
      refundAlready: (amount) =>
        `Your ${amount} deposit has already been returned.`,

      cancelConfirmTitle: "Cancel this visit?",
      cancelConfirmBody: (company) =>
        `${company} will be told straight away, and your time goes back on their calendar.`,
      yesCancel: "Yes, cancel it",
      keepIt: "Keep my visit",
      cancelledTitle: "Visit cancelled",
      cancelledBody: (company) =>
        `${company} has been told. If this was a mistake, get in touch and they'll find you another time.`,
      cancelledRefunded: (amount) =>
        `Your ${amount} deposit is on its way back. It can take a few days to show on your statement.`,

      rescheduleTitle: "Pick a new time",
      rescheduleKeep: "Keep my current time",
      findingTimes: "Finding times…",
      // Shown instead of the raw HTTP failure. "Request failed (405)" is true and
      // useless to a homeowner; the real error goes to the console, and the line
      // under the calendar already tells them to ring.
      timesFailed: "We couldn't load the available times just now.",
      pickADay: "Pick a day to see the times.",
      morning: "Morning",
      afternoon: "Afternoon",
      evening: "Evening",
      nothingThisMonth: "Nothing free this month.",
      tryNextMonth: "Try next month",
      prevMonth: "Previous month",
      nextMonth: "Next month",
      confirmNewTime: "Move my visit here",
      movedTitle: "Your visit has been moved",
      movedBody: (company) =>
        `${company} has been told, and a new confirmation is on its way to you.`,

      questions: (company, phone) =>
        phone
          ? `Questions? Call ${company} on ${phone}.`
          : `Questions? Get in touch with ${company}.`,

      // Failures the server can hand back mid-action. Rendered from its stable
      // `reason` key rather than from its `error` string, which is English —
      // an English sentence in the middle of a Ukrainian page is the failure
      // this whole catalogue exists to prevent. Anything unrecognised falls
      // back to the server's own wording, which is at least accurate.
      slotTaken: "That time has just been taken. Pick another one.",
      tooSoon: "That time doesn't give them enough notice. Pick a later one.",
      refundFailed:
        "We couldn't return your deposit just now, so nothing has been cancelled. Try again in a moment, or get in touch.",
    },
  },

  fr: {
    // "See the property" on /q/[token] — app/components/StreetViewPeek.js.
    streetView: { see: "Voir la propriété", hide: "Masquer", openInMaps: "Ouvrir dans Google Maps", frameTitle: "Vue Street View de la propriété" },
    portalDocumentsHeading: "Documents",

    proposal: {
      contents: "Sommaire",
      yourProject: "Votre projet",
      aboutUs: "À propos de nous",
      beforeAfter: "Avant / après",
      importantDocuments: "Documents importants",
      testimonials: "Témoignages",
      services: "Services",
      scopeOfWork: "Portée des travaux",
      priceByArea: "Prix par zone",
      quoteTotal: "Total de la soumission",
      acceptQuote: "Accepter la soumission",
      day: (n) => `Jour ${n}`,
      crewOf: (n) => `Équipe de ${n}`,
      halfDay: "Demi-journée",
      paintLine: (products, coats) =>
        products && coats ? `Peinture : ${products} · ${coats}` : products ? `Peinture : ${products}` : coats,
      coats: (n) => (n === 1 ? "1 couche" : `${n} couches`),
      viewDocument: "Voir le document →",
      before: "Avant",
      after: "Après",
      recentWork: "Travaux récents",
      documentsHeading: "Certificats et documents",
      whatClientsSaid: "Ce que disent nos clients",
      whatElseWeDo: "Nos autres services",
      watchVideo: "Regarder notre vidéo de présentation",
      teamPhotoAlt: "Notre équipe",
    },
    // ── /estimate-report/[token] — the instant estimate as a proposal ─────
    // The same presentation as the quote, with the RANGE where the prices
    // would be (app/estimate-report/[token]/ReportView.js).
    rangeProposal: {
      yourEstimate: "Votre estimation",
      estimateWord: "Estimation",
      estimatedRange: "Fourchette estimée",
      subjectToVisit: "Estimation — sous réserve d'une visite sur place",
      rangeFor: (option) => `Pour : ${option}`,
      rangeNote: (company) => `Selon les renseignements que vous avez fournis. ${company} confirme le prix final après avoir vu les travaux sur place — rien n'est ferme tant que vous n'avez pas approuvé une soumission.`,
      noRange: (company) => `${company} confirmera votre prix après une visite sur place.`,
      whatHappensNext: "La suite",
      bookVisit: "Réserver votre visite sur place",
      talkToUs: "Nous joindre",
    },
    waiverKicker: "Décharge",
    waiverAttachedTo: (ref) => `Jointe à ${ref}`,
    waiverIntro: "Veuillez lire chaque section et cocher que vous l'avez comprise. La signature est à la fin.",
    waiverAcknowledgements: "Reconnaissances",
    waiverSign: "Signer",
    waiverAcknowledged: (n, total) => `${n} sur ${total} reconnues`,
    signWaiver: "Signer la décharge",
    waiverTickRemaining: (n) =>
      n === 1 ? "Cochez la reconnaissance restante pour pouvoir signer." : `Cochez les ${n} reconnaissances restantes pour pouvoir signer.`,
    waiverConsent: "J'accepte que ma signature ici constitue ma signature électronique et que j'ai lu et accepté cette décharge.",
    waiverSignedTitle: "Décharge signée — merci",
    waiverSignedBody: (company) => `Une copie vous a été envoyée et classée chez ${company}.`,
    waiverSignedOn: (date) => `Signée le ${date}`,
    waiverSignedBy: (name, date) => `Signée par ${name} le ${date}`,
    waiverAfterNote: "Une fois signée, une copie avec la date, votre nom et chaque reconnaissance vous est envoyée et classée au dossier des travaux. La soumission se signe séparément.",
    waiverRequiredBeforeApprove: "Signez la décharge jointe avant d'approuver cette soumission.",
    waiverCopyIntro: (company) => `Votre copie signée de la décharge pour ${company} est ci-jointe.`,
    waiverLinkIntro: (company, title) => `${company} a un document à vous faire lire et signer : « ${title} ». Cela prend une minute.`,
    waiverOpen: "Lire et signer",
    approveThisQuote: "Approuver cette soumission",
    decline: "Refuser",
    whatsIncluded: "Ce qui est inclus",
    whatCouldChange: "Ce qui pourrait modifier ce prix",
    termsExplained: "Les termes de cette soumission, expliqués",
    optionalExtras: "Options supplémentaires",
    extrasTickHint:
      "Cochez ce que vous souhaitez ajouter. Le total se met à jour au fur et à mesure — rien n'est facturé avant votre approbation.",
    extrasChosen: "Choisi lors de l'approbation de cette soumission.",
    includesOptionalExtras: "Comprend les options supplémentaires",
    payOfflineHint: "Vous paierez par virement Interac ou par chèque plutôt que par carte.",
    howTheWorkRuns: "Déroulement des travaux",
    paymentTerms: "Modalités de paiement",
    yourFullName: "Votre nom complet",
    typeYourName: "Saisissez votre nom",
    signature: "Signature",
    signatureConsent: (total) =>
      `J'accepte que ma signature ici constitue ma signature électronique et approuve cette soumission pour ${total}.`,
    approveConfirm: (total) => `Approuver cette soumission pour ${total} ?`,
    declineConfirm: "Refuser cette soumission ?",
    approveSubExtras: (extras) =>
      `Comprend ${extras} d'options supplémentaires. Cela leur indique d'aller de l'avant.`,
    approveSubPlain: "Cela leur indique d'aller de l'avant.",
    declineSub: "Vous pouvez toujours demander une soumission révisée.",
    yesApprove: "Oui, approuver",
    yesDecline: "Oui, refuser",
    goBack: "Retour",
    approvedTitle: "Approuvée — merci",
    approvedBody: (company) =>
      `${company} a été avisé et vous contactera au sujet des prochaines étapes.`,
    declinedTitle: "Soumission refusée",
    declinedBody: (company) =>
      `${company} a été avisé. S'il s'agit d'une erreur, appelez-les.`,
    expiredTitle: "Cette soumission est expirée",
    expiredBody: (company) =>
      `Contactez ${company} pour obtenir un prix à jour.`,
    approvedCopyIntro: (company) =>
      `Merci d'avoir approuvé votre soumission avec ${company}. Une copie est jointe pour vos dossiers.`,
    measuredAt: (address) => `Mesuré à l'adresse : ${address}`,
    genericError: "Une erreur s'est produite. Réessayez.",
    connectionLost: "Impossible de charger votre soumission.",
    connectionLostHint:
      "Vous avez peut-être perdu le signal. Vérifiez votre connexion et réessayez — rien n'a été envoyé.",
    tryAgain: "Réessayer",
    linkInvalidHint:
      "Communiquez avec l'entreprise qui vous l'a envoyée : elle peut vous transmettre un nouveau lien.",

    financingAvailable: "Financement",
    financingHeading: "Payer mensuellement",
    financingMonthly: (monthly) => `Environ ${monthly} par mois`,
    financingTermsLine: (months, apr) =>
      `Estimation sur ${months} mois à un TAEG de ${apr}.`,
    financingEstimateNote: (company) =>
      `Estimation seulement, selon les conditions annoncées par ${company} et le total ci-dessus. Votre organisme de financement confirme le taux, la mensualité et l'approbation réels au moment de la demande.`,
    financingCta: "Voir les options de financement",
    quoteQuestions: (company, phone) =>
      phone
        ? `Des questions ? Répondez au courriel ou appelez ${company} au ${phone}.`
        : `Des questions ? Répondez au courriel ou appelez ${company}.`,

    accountFor: (name) => `Compte de ${name}`,
    balanceOwing: "Solde dû",
    nothingOutstanding: "Rien en souffrance. Merci.",
    acrossInvoices: (n) => `Réparti sur ${n} facture${n === 1 ? "" : "s"}.`,
    invoicesHeading: "Factures",
    quotesHeading: "Soumissions",
    paidNote: (amount) => `${amount} payé`,
    dueNote: (date) => `échéance ${date}`,
    pay: (amount) => `Payer ${amount}`,
    paid: "Payé",
    review: "Consulter",
    // Keyed by the QuoteStatus enum — see the note in the `en` block.
    quoteStatus: {
      draft: "Brouillon",
      sent: "En attente de votre réponse",
      accepted: "Approuvée",
      declined: "Refusée",
    },
    paymentReceived:
      "Paiement reçu — merci. Son affichage ci-dessous peut prendre une minute.",
    payCard: (amount) => `Payer ${amount} par carte`,
    payBank: (amount) => `Payer ${amount} depuis un compte bancaire`,
    bankNote: "Un paiement bancaire prend de 3 à 5 jours ouvrables pour être compensé. D'ici là, la facture apparaît en attente.",
    bankPendingBanner: "Paiement bancaire reçu — il faut de 3 à 5 jours ouvrables pour qu'il soit compensé. La facture apparaîtra comme payée ensuite.",
    bankPending: "Paiement bancaire en attente",
    bankFailed: (reason) => `Le paiement bancaire a échoué${reason ? ` — ${reason}` : ""}. Vous pouvez réessayer ou payer par carte.`,
    bankOverCap: (max, amount) => `Le prélèvement bancaire est offert jusqu'à ${max} par paiement — cette facture est de ${amount}, donc par carte seulement.`,
    paymentNotStarted: (company) => `Ce paiement n'a pas pu démarrer — veuillez essayer par carte ou contacter ${company}.`,
    portalQuestions: (company, phone, email) =>
      `Des questions à ce sujet ? Contactez ${company}${phone ? ` au ${phone}` : ""}${email ? ` · ${email}` : ""}.`,

    backToAccount: "Retour à votre compte",
    due: "Échéance",
    wasDue: "Était dû",
    noItemisedBreakdown: "Aucun détail sur cette facture.",
    paidInFull: "Payée en totalité",
    paidInFullThanks: "Payée en totalité — merci",
    invoiceNotFound: "Cette facture n'est pas dans votre compte.",
    arrangePayment: "Veuillez nous contacter pour organiser le paiement.",
    acceptedMethods: (methods) => `Modes de paiement acceptés : ${methods}.`,

    portal: {
      nextVisitKicker: "Prochaine visite",
      planKicker: "Votre forfait",
      upcomingHeading: "Visites à venir",
      pastHeading: "Visites passées",
      between: (from, to) => `entre ${from} et ${to}`,
      at: (time) => `à ${time}`,
      withCrew: (name) => `avec ${name}`,
      typeVisit: "Visite",
      typeReturn: "Visite de retour",
      typeAppointment: "Rendez-vous",
      typeCall: "Appel téléphonique",
      typeVideo: "Appel vidéo",
      frequency: {
        weekly: "Chaque semaine",
        monthly: "Chaque mois",
        quarterly: "Tous les 3 mois",
        semiannual: "Deux fois par an",
        annual: "Une fois par an",
      },
      perVisit: (amount) => `${amount} par visite`,
      taxIncluded: "taxes incluses",
      memberDiscount: (pct) => `Comprend votre rabais de forfait de ${pct} %`,
      included: "Ce qui est inclus",
      nextDates: "Prochaines dates",
      endsOn: (date) => `Forfait valide jusqu'au ${date}`,
      visitsSold: (n) => (n === 1 ? "1 visite dans ce forfait" : `${n} visites dans ce forfait`),
      reschedule: "Demander un autre moment",
      skip: "Sauter cette visite",
      rescheduleQuestion: "Qu'est-ce qui vous conviendrait mieux ?",
      skipQuestion: "Quelque chose à nous dire ? (facultatif)",
      requestPlaceholder: "Par exemple : n'importe quel jour de semaine après le 20",
      requestExplain: (company) => `${company} vous répondra. Rien ne change tant qu'ils n'ont pas confirmé.`,
      requestSend: "Envoyer la demande",
      cancel: "Annuler",
      requested: "Demande envoyée",
      requestTooLate: "Cette visite est trop proche pour être modifiée ici. Veuillez plutôt appeler.",
      requestFailed: "Votre demande n'a pas pu être envoyée. Réessayez ou appelez.",
      callToChange: "Dans moins d'un jour. Appelez pour la modifier.",
      photoAlt: "Photo de cette visite",
      loginEmailSubject: (company) => `Votre compte chez ${company}`,
      loginEmailLabel: "Votre compte",
      loginEmailGreeting: (first) => (first ? `Bonjour ${first},` : "Bonjour,"),
      loginEmailIntro: (company) => `Voici le lien vers votre compte chez ${company} : vos soumissions, factures, visites et forfaits au même endroit.`,
      loginEmailButton: "Ouvrir votre compte",
      loginEmailKeep: "Ce lien vous est personnel. Gardez-le pour vous et ajoutez-le à vos favoris pour y revenir quand vous voulez.",
      loginEmailIgnore: "Si vous n'avez pas demandé ce lien, vous pouvez ignorer ce courriel. Rien n'a changé dans votre compte.",
      rescheduleSubject: (what, date) => `Déplacer ${what} du ${date}`,
      skipSubject: (what, date) => `Sauter ${what} du ${date}`,
      requestNoMessage: "Aucun message — merci de proposer une autre date.",
      maintenanceSubject: (plan) => `Réserver ma prochaine visite — ${plan}`,
      preferredLine: (when) => `Ce qui me convient : ${when}`,
      maintenanceNoNote: "Merci de proposer une date pour ma prochaine visite incluse.",
      ticketReplySubject: (subject) => `Re : ${subject}`,
      ticketReplyIntro: (who, subject) => `${who} a répondu au sujet de « ${subject} » :`,
      ticketReplyButton: "Voir et répondre",
      ticketEmailLabel: "Votre demande",
      tickets: {
        heading: "Vos demandes",
        reportIssue: "Signaler un problème",
        requestWork: "Demander des travaux",
        reportOnVisit: "Signaler un problème",
        reportTitle: "Signaler un problème",
        aboutVisit: (date) => `Au sujet de la visite du ${date}`,
        typeLabel: "De quoi s'agit-il ?",
        types: {
          repair: "Quelque chose à réparer",
          warranty: "Réclamation sous garantie",
          question: "Une question",
          billing: "Facturation",
          reschedule: "Changer une date",
          maintenance: "Visite d'entretien",
        },
        subjectLabel: "Résumé court",
        bodyLabel: "Dites-nous ce qui se passe",
        photosLabel: "Photos (facultatif)",
        addPhoto: "Ajouter une photo",
        uploading: "Téléversement…",
        uploadFailed: "Cette photo n'a pas pu être téléversée.",
        send: "Envoyer",
        cancel: "Annuler",
        sent: (company) => `Envoyé. ${company} vous répondra ici et par courriel.`,
        failed: "L'envoi a échoué. Veuillez réessayer.",
        status: {
          open: "Reçue",
          in_progress: "En cours",
          waiting_on_client: "En attente de vous",
          resolved: "Résolue",
          closed: "Fermée",
        },
        you: "Vous",
        replyPlaceholder: "Écrire une réponse…",
        sendReply: "Envoyer la réponse",
        closedNote: "Cette demande est fermée. Signalez un nouveau problème si autre chose survient.",
        workTitle: "Demander des travaux",
        workNewJob: "Un nouveau chantier ou une soumission",
        workMaintenance: "Une visite d'entretien",
        workService: "Quel service ?",
        workServiceOther: "Autre chose",
        workDescribe: "Décrivez les travaux",
        workDates: "Dates souhaitées (facultatif)",
        workDatesPlaceholder: "Par exemple : un jour de semaine début novembre",
        workSent: (company) => `Envoyé. ${company} vous recontactera pour confirmer. Rien n'est réservé ni facturé avant.`,
        workPlan: "Quel forfait ?",
        workRemaining: (n) => (n === 1 ? "1 visite incluse restante" : `${n} visites incluses restantes`),
        workUntilCancelled: "Les visites continuent jusqu'à la fin du forfait",
        workWindow: "Quand cela vous convient-il ?",
        workWindowPlaceholder: "Par exemple : le matin, la semaine du 10",
        workNote: "Autre chose ? (facultatif)",
        workSetupIntro: (company) => `Vous n'avez pas encore de forfait d'entretien. Dites à ${company} ce que vous aimeriez faire entretenir régulièrement et à quelle fréquence, et on vous proposera des options.`,
        workSetupDescribe: "Qu'est-ce qui doit être entretenu, et à quelle fréquence ?",
        workConfirmNote: (company) => `${company} confirme tout avant de réserver. Rien n'est planifié ni facturé d'ici.`,
      },
    },

    job: {
      kicker: "Vos travaux",
      dayOf: (day, total) => `Jour ${day} sur ${total}`,
      onSchedule: "dans les temps",
      runningLate: "en retard",
      finished: "Terminé",
      started: (date) => `Commencé le ${date}`,
      finishPlanned: (date) => `Fin prévue le ${date}`,
      datesToConfirm: "Dates à confirmer",
      done: "Terminé",
      inProgress: "En cours",
      waitingOn: "En attente de",
      upNext: "À suivre",
      photos: (n) => (n === 1 ? "1 photo" : `${n} photos`),
      onSiteSince: (names, time) => `${names} sur place depuis ${time}`,
      photoAdded: (time) => `Photo ajoutée à ${time}`,
      today: "Aujourd'hui",
      waitingOnStep: (title) => `En attente de : ${title}`,
      waitingOnExternal: (reason) => `En attente de : ${reason}`,
      waitingOnApproval: (label) => `En attente de votre approbation de l'avenant ${label}`,
      waitingOnYou: "À vous de jouer",
      reviewAndSign: "Consulter et signer",
      datesNote: "Les dates sont le plan de l'équipe et peuvent changer.",
      changesHeading: "Changements en attente de votre approbation",
      approvedChange: (label, date) => `${label} approuvé le ${date}`,
      stepsDone: (done, total) => `${done} étape(s) sur ${total} terminée(s)`,
    },

    changeOrder: {
      kicker: "Avenant",
      toQuote: (number) => `à la soumission ${number}`,
      forClient: (name) => `Pour ${name}`,
      originalLine: "Ligne d'origine",
      theChange: "Le changement",
      photo: (when) => `Photo · ${when}`,
      quoteTotalAsApproved: (date) => (date ? `Total de la soumission approuvée le ${date}` : "Total de la soumission approuvée"),
      priorChanges: "Changements déjà approuvés",
      thisChange: "Ce changement",
      taxOnChange: (rate) => `Taxes de ${rate} sur le changement`,
      taxUnknown: "Les taxes sur ce changement ne sont pas indiquées ici ; votre facture les précisera au taux de la soumission.",
      newTotal: "Nouveau total",
      schedule: "Calendrier",
      finishMoves: (from, to, days) => `La fin passe du ${from} au ${to} (${days})`,
      finishMovesBy: (days) => `La fin est décalée de ${days}`,
      days: (n) => (n === 1 || n === -1 ? `${n > 0 ? "+" : "−"}1 jour` : `${n > 0 ? "+" : "−"}${Math.abs(n)} jours`),
      scheduleUnchanged: "Aucun changement au calendrier",
      consent: (amount, total) => `J'approuve ce changement de ${amount} taxes incluses, ce qui porte le nouveau total à ${total}.`,
      consentSchedule: (days) => ` J'approuve aussi le changement de calendrier (${days}).`,
      approveAndSign: "Approuver et signer",
      askQuestion: "Poser une question",
      footer: (company, phone) => `La soumission que vous avez signée reste inchangée ; cet avenant s'y ajoute. Des questions ? Répondez au texto ou appelez ${company}${phone ? ` au ${phone}` : ""}.`,
      approvedTitle: "Approuvé — merci",
      approvedBody: (company) => `${company} a reçu votre approbation signée et poursuivra le changement.`,
      approvedOn: (date) => `Approuvé le ${date}.`,
      withdrawnTitle: "Ce changement a été retiré",
      withdrawnBody: (company) => `${company} a retiré cet avenant. Rien ne change sur votre soumission.`,
      notFound: "Ce lien n'est pas valide.",
      notFoundBody: "Contactez l'entreprise avec laquelle vous travaillez pour en obtenir un nouveau.",
      signFailed: "Impossible d'enregistrer votre approbation pour le moment. Réessayez dans un instant.",
      emailSubject: (label, company) => `${label} de ${company} — à consulter et signer`,
      emailIntro: (name, label, number) => `Bonjour ${name}, un changement à vos travaux (${label}${number ? `, soumission ${number}` : ""}) doit être approuvé avant que le travail se poursuive.`,
      emailButton: "Consulter et signer",
      emailFooter: "Rien ne change sur votre soumission ou votre facture tant que vous n'avez pas signé.",
      smsText: (company, label, url) => `${company} : l'avenant ${label} pour vos travaux doit être approuvé — consultez et signez ici : ${url}`,
    },

    selfQuote: {
      documentWord: "Demande",
      eyebrow: "Demander une soumission",
      languageLabel: "Langue",

      step1Title: "Comment pouvons-nous vous aider ?",
      step1Hint:
        "Choisissez ce qui s'en rapproche le plus — nous préciserons les détails.",
      noServices: (phone) =>
        `Cette entreprise n'a pas encore configuré ses services. Communiquez directement avec elle${phone ? ` au ${phone}` : ""}.`,

      step2Hint:
        "Des chiffres approximatifs suffisent — rien ici n'est engageant.",
      designKitchen: "Vous préférez le dessiner? Concevez votre cuisine vous-même et envoyez-nous le plan →",
      timelineLabel: "Quand souhaitez-vous commencer ?",
      timelineAsap: "Dès que possible",
      timeline2Weeks: "D'ici 2 semaines",
      timeline1To3Months: "Dans 1 à 3 mois",
      timelineExploring: "Je me renseigne seulement",
      budgetLabel: "Budget approximatif ?",
      optional: "(facultatif)",
      budgetUnder: (s) => `Moins de ${s}1 000`,
      budgetLow: (s) => `${s}1 000 – ${s}5 000`,
      budgetMid: (s) => `${s}5 000 – ${s}15 000`,
      budgetHigh: (s) => `${s}15 000 et plus`,
      budgetUnsure: "Je ne sais pas encore",
      notesLabel: "Autre chose à nous signaler ?",
      notesPlaceholder:
        "Photos, échéancier, accès, tout ce qui sort de l'ordinaire…",
      continueCta: "Continuer",

      step3Title: "Où devons-nous vous répondre ?",
      step3Hint: "Un courriel ou un téléphone suffit.",
      namePlaceholder: "Votre nom",
      emailPlaceholder: "Courriel",
      phonePlaceholder: "Téléphone",
      addressPlaceholder: "Où sont les travaux ?",
      errAddress: "Veuillez indiquer l’adresse des travaux.",

      uploadLabel: "Ajouter des photos, une vidéo ou un plan PDF",
      uploadHint:
        "Une photo, un court clip ou votre plan PDF nous aide à chiffrer avec précision.",
      uploadDocumentFallback: "Plan PDF",
      uploadBusy: "Téléversement…",
      uploadLimit: (n) => `Vous pouvez joindre jusqu'à ${n} fichiers.`,
      uploadFailed:
        "Échec du téléversement — vérifiez votre connexion et réessayez.",
      uploadRejected: "Ce fichier n'a pas pu être téléversé.",
      uploadTooLarge: (size, limit) => `Ce fichier fait ${size} — la taille maximale par envoi est de ${limit}. Prenez la photo en plus petit format, ou redimensionnez-la et réessayez.`,
      uploadRemove: "Retirer",
      back: "Retour",
      sendCta: "Envoyer ma demande",
      noObligation: (company) =>
        `Sans obligation. ${company} vous reviendra avec un prix.`,

      errName: "Veuillez nous indiquer votre nom.",
      errContact:
        "Ajoutez un courriel ou un numéro de téléphone pour que nous puissions répondre.",
      errSend: "Impossible d'envoyer votre demande.",
      linkInvalid: "Ce lien n'est pas valide.",
      linkInvalidHint:
        "Vérifiez le lien ou communiquez directement avec l'entreprise.",

      confirmTitle: "Demande reçue",
      confirmIntro: (company) =>
        `${company} a tout ce qui suit et vous reviendra avec un prix.`,
      requestedHeading: "Ce que vous avez demandé",
      nextHeading: "Les prochaines étapes",
      next1Title: "Ils la lisent",
      next1Body:
        "Vos réponses parviennent immédiatement à l'entreprise, avec tout ce que vous avez joint.",
      next2Title: "Ils établissent le prix",
      next2Body:
        "Une personne calcule le coût réel de vos travaux — rien ici n'a été chiffré automatiquement.",
      next3Title: "Vous recevez une soumission",
      next3Body:
        "Elle arrive sous forme de document que vous pouvez lire, questionner et approuver. Rien n'est conclu avant cela.",
      estimateLabel: "Fourchette estimée",
      beforeTax: "avant taxes",
      gatedNote:
        "Aucun prix n'est affiché pour l'instant — cette demande n'a pas été chiffrée. C'est voulu : le montant que vous recevrez sera assumé par une personne.",
      submittedLabel: "Envoyée le",
      copySentTo: (email) => `Une copie est en route vers ${email}.`,
      callInstead: "Besoin plus rapidement ?",
      // The in-person visit offered under the confirmation. Only rendered when
      // the company can actually take a booking — see lib/booking/canBookVisit.js.
      bookVisitTitle: "Souhaitez-vous que nous venions voir ?",
      bookVisitBody:
        "Réservez une visite sur place et nous confirmerons votre prix chez vous.",
      bookVisitCta: "Réserver une visite",

      emailSubject: (company) => `Votre demande à ${company}`,
      emailIntro: (company) =>
        `Merci — ${company} a bien reçu votre demande. Voici ce que vous avez envoyé, pour vos dossiers.`,
    },

    visit: {
      eyebrow: "Votre rendez-vous",
      loadFailed: "Nous n'avons pas pu charger votre rendez-vous.",
      loadFailedHint:
        "Vérifiez le lien reçu par courriel, ou communiquez directement avec l'entreprise.",

      aboutEstimate: (number) => `Au sujet de votre soumission ${number}`,

      whenLabel: "Quand",
      whereLabel: "Où",
      modeVisit: "Nous nous déplaçons chez vous",
      modeCall: "Appel téléphonique — nous vous appellerons",
      modeVideo: "Appel vidéo — nous vous enverrons un lien par courriel",
      addressUnknown: "Adresse à confirmer",
      depositPaid: (amount) => `Dépôt de ${amount} payé`,

      changeHeading: "Besoin de changer quelque chose ?",
      rescheduleCta: "Changer l'heure",
      cancelCta: "Annuler ce rendez-vous",

      cannotCancelled: "Ce rendez-vous a déjà été annulé.",
      cannotHappened: "Ce rendez-vous a déjà eu lieu.",
      cannotAwaitingPayment:
        "Ce rendez-vous n'est pas encore confirmé — le paiement n'est pas passé.",
      cannotNotFound: "Ce lien ne correspond à aucun rendez-vous.",
      cannotTooLate: (notice, company) =>
        `${company} demande un préavis d'au moins ${notice}; ce rendez-vous ne peut donc plus être modifié ici.`,
      cannotTooLateNoNotice: (company) =>
        `Il est maintenant trop tard pour que ${company} accepte un changement ici.`,
      noticeHours: (n) => (n === 1 ? "1 heure" : `${n} heures`),
      callInstead: (company, phone) =>
        phone
          ? `Appelez ${company} au ${phone} — ils peuvent encore le déplacer pour vous.`
          : `Communiquez avec ${company} — ils peuvent encore le déplacer pour vous.`,

      refundYes: (amount) =>
        `Votre dépôt de ${amount} sera remboursé sur la carte utilisée.`,
      refundNo: (amount) =>
        `Votre dépôt de ${amount} n'est pas remboursé automatiquement — communiquez avec eux à ce sujet.`,
      refundAlready: (amount) =>
        `Votre dépôt de ${amount} a déjà été remboursé.`,

      cancelConfirmTitle: "Annuler ce rendez-vous ?",
      cancelConfirmBody: (company) =>
        `${company} en sera avisé immédiatement, et votre plage horaire sera libérée.`,
      yesCancel: "Oui, annuler",
      keepIt: "Garder mon rendez-vous",
      cancelledTitle: "Rendez-vous annulé",
      cancelledBody: (company) =>
        `${company} a été avisé. S'il s'agit d'une erreur, communiquez avec eux et ils vous trouveront un autre moment.`,
      cancelledRefunded: (amount) =>
        `Votre dépôt de ${amount} est en route. Quelques jours peuvent s'écouler avant qu'il paraisse sur votre relevé.`,

      rescheduleTitle: "Choisissez une nouvelle heure",
      rescheduleKeep: "Garder mon heure actuelle",
      findingTimes: "Recherche des disponibilités…",
      timesFailed:
        "Nous n'avons pas pu charger les disponibilités pour l'instant.",
      pickADay: "Choisissez une journée pour voir les heures.",
      morning: "Matin",
      afternoon: "Après-midi",
      evening: "Soir",
      nothingThisMonth: "Rien de libre ce mois-ci.",
      tryNextMonth: "Essayer le mois prochain",
      prevMonth: "Mois précédent",
      nextMonth: "Mois suivant",
      confirmNewTime: "Déplacer mon rendez-vous ici",
      movedTitle: "Votre rendez-vous a été déplacé",
      movedBody: (company) =>
        `${company} a été avisé, et une nouvelle confirmation vous sera envoyée.`,

      questions: (company, phone) =>
        phone
          ? `Des questions ? Appelez ${company} au ${phone}.`
          : `Des questions ? Communiquez avec ${company}.`,

      slotTaken: "Cette heure vient d'être prise. Choisissez-en une autre.",
      tooSoon:
        "Cette heure ne leur laisse pas assez de préavis. Choisissez-en une plus tardive.",
      refundFailed:
        "Nous n'avons pas pu rembourser votre dépôt pour l'instant, donc rien n'a été annulé. Réessayez dans un moment, ou communiquez avec eux.",
    },
  },

  es: {
    // "See the property" on /q/[token] — app/components/StreetViewPeek.js.
    streetView: { see: "Ver la propiedad", hide: "Ocultar", openInMaps: "Abrir en Google Maps", frameTitle: "Vista de Street View de la propiedad" },
    portalDocumentsHeading: "Documentos",

    proposal: {
      contents: "Contenido",
      yourProject: "Su proyecto",
      aboutUs: "Sobre nosotros",
      beforeAfter: "Antes y después",
      importantDocuments: "Documentos importantes",
      testimonials: "Testimonios",
      services: "Servicios",
      scopeOfWork: "Alcance del trabajo",
      priceByArea: "Precio por área",
      quoteTotal: "Total del presupuesto",
      acceptQuote: "Aceptar presupuesto",
      day: (n) => `Día ${n}`,
      crewOf: (n) => `Equipo de ${n}`,
      halfDay: "Medio día",
      paintLine: (products, coats) =>
        products && coats ? `Pintura: ${products} · ${coats}` : products ? `Pintura: ${products}` : coats,
      coats: (n) => (n === 1 ? "1 mano" : `${n} manos`),
      viewDocument: "Ver documento →",
      before: "Antes",
      after: "Después",
      recentWork: "Trabajos recientes",
      documentsHeading: "Certificados y documentos",
      whatClientsSaid: "Lo que dicen nuestros clientes",
      whatElseWeDo: "Qué más hacemos",
      watchVideo: "Ver nuestro video de presentación",
      teamPhotoAlt: "Nuestro equipo",
    },
    // ── /estimate-report/[token] — the instant estimate as a proposal ─────
    // The same presentation as the quote, with the RANGE where the prices
    // would be (app/estimate-report/[token]/ReportView.js).
    rangeProposal: {
      yourEstimate: "Su estimación",
      estimateWord: "Estimación",
      estimatedRange: "Rango estimado",
      subjectToVisit: "Estimación — sujeta a una visita al sitio",
      rangeFor: (option) => `Para: ${option}`,
      rangeNote: (company) => `Según los datos que nos dio. ${company} confirma el precio final después de ver el trabajo en persona — nada es definitivo hasta que usted apruebe una cotización.`,
      noRange: (company) => `${company} confirmará su precio después de una visita al sitio.`,
      whatHappensNext: "Qué sigue",
      bookVisit: "Reserve su visita al sitio",
      talkToUs: "Hable con nosotros",
    },
    waiverKicker: "Exención de responsabilidad",
    waiverAttachedTo: (ref) => `Adjunta a ${ref}`,
    waiverIntro: "Lea cada sección y marque que la entiende. La firma está al final.",
    waiverAcknowledgements: "Reconocimientos",
    waiverSign: "Firmar",
    waiverAcknowledged: (n, total) => `${n} de ${total} reconocidos`,
    signWaiver: "Firmar la exención",
    waiverTickRemaining: (n) =>
      n === 1 ? "Marque el reconocimiento restante para poder firmar." : `Marque los ${n} reconocimientos restantes para poder firmar.`,
    waiverConsent: "Acepto que firmar aquí constituye mi firma electrónica y que he leído y acepto esta exención.",
    waiverSignedTitle: "Exención firmada — gracias",
    waiverSignedBody: (company) => `Se le ha enviado una copia y se ha archivado en ${company}.`,
    waiverSignedOn: (date) => `Firmada el ${date}`,
    waiverSignedBy: (name, date) => `Firmada por ${name} el ${date}`,
    waiverAfterNote: "Una vez firmada, se le envía una copia con la fecha, su nombre y cada reconocimiento, y se archiva en este trabajo. El presupuesto se firma por separado.",
    waiverRequiredBeforeApprove: "Firme la exención adjunta antes de aprobar este presupuesto.",
    waiverCopyIntro: (company) => `Adjuntamos su copia firmada de la exención para ${company}.`,
    waiverLinkIntro: (company, title) => `${company} tiene un documento para que lo lea y firme: «${title}». Toma un minuto.`,
    waiverOpen: "Leer y firmar",
    approveThisQuote: "Aprobar este presupuesto",
    decline: "Rechazar",
    whatsIncluded: "Qué incluye",
    whatCouldChange: "Qué podría cambiar este precio",
    termsExplained: "Los términos de este presupuesto, explicados",
    optionalExtras: "Extras opcionales",
    extrasTickHint:
      "Marque lo que desee añadir. El total se actualiza sobre la marcha — no se cobra nada hasta que usted apruebe.",
    extrasChosen: "Elegido al aprobar este presupuesto.",
    includesOptionalExtras: "Incluye extras opcionales",
    payOfflineHint: "Pagará por transferencia electrónica o cheque en lugar de con tarjeta.",
    howTheWorkRuns: "Cómo se realiza el trabajo",
    paymentTerms: "Condiciones de pago",
    yourFullName: "Su nombre completo",
    typeYourName: "Escriba su nombre",
    signature: "Firma",
    signatureConsent: (total) =>
      `Acepto que firmar aquí es mi firma electrónica y aprueba este presupuesto por ${total}.`,
    approveConfirm: (total) => `¿Aprobar este presupuesto por ${total}?`,
    declineConfirm: "¿Rechazar este presupuesto?",
    approveSubExtras: (extras) =>
      `Incluye ${extras} en extras opcionales. Esto les indica que sigan adelante.`,
    approveSubPlain: "Esto les indica que sigan adelante.",
    declineSub: "Siempre puede pedir un presupuesto revisado.",
    yesApprove: "Sí, aprobar",
    yesDecline: "Sí, rechazar",
    goBack: "Volver",
    approvedTitle: "Aprobado — gracias",
    approvedBody: (company) =>
      `Se ha notificado a ${company} y se pondrán en contacto sobre los próximos pasos.`,
    declinedTitle: "Presupuesto rechazado",
    declinedBody: (company) =>
      `Se ha notificado a ${company}. Si fue un error, llámelos.`,
    expiredTitle: "Este presupuesto ha vencido",
    expiredBody: (company) =>
      `Comuníquese con ${company} para un precio actualizado.`,
    approvedCopyIntro: (company) =>
      `Gracias por aprobar su presupuesto con ${company}. Se adjunta una copia para sus registros.`,
    measuredAt: (address) => `Medido en: ${address}`,
    genericError: "Algo salió mal. Inténtelo de nuevo.",
    connectionLost: "No pudimos cargar su presupuesto.",
    connectionLostHint:
      "Puede que haya perdido la señal. Compruebe su conexión y vuelva a intentarlo: no se ha enviado nada.",
    tryAgain: "Reintentar",
    linkInvalidHint:
      "Póngase en contacto con la empresa que se lo envió y le enviarán un enlace nuevo.",

    financingAvailable: "Financiación",
    financingHeading: "Pagar a plazos",
    financingMonthly: (monthly) => `Alrededor de ${monthly} al mes`,
    financingTermsLine: (months, apr) =>
      `Estimado a ${months} meses con una TAE del ${apr}.`,
    financingEstimateNote: (company) =>
      `Solo es una estimación, según las condiciones indicadas por ${company} y el total anterior. Su entidad financiera confirma el tipo de interés, la cuota y la aprobación reales cuando usted lo solicita.`,
    financingCta: "Ver opciones de financiación",
    quoteQuestions: (company, phone) =>
      phone
        ? `¿Preguntas? Responda al correo o llame a ${company} al ${phone}.`
        : `¿Preguntas? Responda al correo o llame a ${company}.`,

    accountFor: (name) => `Cuenta de ${name}`,
    balanceOwing: "Saldo pendiente",
    nothingOutstanding: "Nada pendiente. Gracias.",
    acrossInvoices: (n) => `En ${n} factura${n === 1 ? "" : "s"}.`,
    invoicesHeading: "Facturas",
    quotesHeading: "Presupuestos",
    paidNote: (amount) => `${amount} pagado`,
    dueNote: (date) => `vence ${date}`,
    pay: (amount) => `Pagar ${amount}`,
    paid: "Pagado",
    review: "Revisar",
    // Keyed by the QuoteStatus enum — see the note in the `en` block.
    quoteStatus: {
      draft: "Borrador",
      sent: "Pendiente de su respuesta",
      accepted: "Aprobado",
      declined: "Rechazado",
    },
    paymentReceived:
      "Pago recibido — gracias. Puede tardar un minuto en aparecer abajo.",
    payCard: (amount) => `Pagar ${amount} con tarjeta`,
    payBank: (amount) => `Pagar ${amount} desde una cuenta bancaria`,
    bankNote: "Un pago bancario tarda de 3 a 5 días hábiles en compensarse. Hasta entonces la factura aparece como pendiente.",
    bankPendingBanner: "Pago bancario recibido: tarda de 3 a 5 días hábiles en compensarse. La factura aparecerá como pagada cuando se complete.",
    bankPending: "Pago bancario pendiente",
    bankFailed: (reason) => `El pago bancario falló${reason ? `: ${reason}` : ""}. Puede intentarlo de nuevo o pagar con tarjeta.`,
    bankOverCap: (max, amount) => `El débito bancario está disponible hasta ${max} por pago; esta factura es de ${amount}, así que solo con tarjeta.`,
    paymentNotStarted: (company) => `No se pudo iniciar este pago. Intente con tarjeta o comuníquese con ${company}.`,
    portalQuestions: (company, phone, email) =>
      `¿Preguntas sobre esto? Comuníquese con ${company}${phone ? ` al ${phone}` : ""}${email ? ` · ${email}` : ""}.`,

    backToAccount: "Volver a su cuenta",
    due: "Vence",
    wasDue: "Venció",
    noItemisedBreakdown: "Sin desglose en esta factura.",
    paidInFull: "Pagada por completo",
    paidInFullThanks: "Pagada por completo — gracias",
    invoiceNotFound: "Esa factura no está en su cuenta.",
    arrangePayment:
      "Por favor comuníquese con nosotros para coordinar el pago.",
    acceptedMethods: (methods) => `Formas de pago aceptadas: ${methods}.`,

    portal: {
      nextVisitKicker: "Próxima visita",
      planKicker: "Su plan",
      upcomingHeading: "Próximas visitas",
      pastHeading: "Visitas anteriores",
      between: (from, to) => `entre ${from} y ${to}`,
      at: (time) => `a las ${time}`,
      withCrew: (name) => `con ${name}`,
      typeVisit: "Visita",
      typeReturn: "Visita de regreso",
      typeAppointment: "Cita",
      typeCall: "Llamada telefónica",
      typeVideo: "Videollamada",
      frequency: {
        weekly: "Cada semana",
        monthly: "Cada mes",
        quarterly: "Cada 3 meses",
        semiannual: "Dos veces al año",
        annual: "Una vez al año",
      },
      perVisit: (amount) => `${amount} por visita`,
      taxIncluded: "impuestos incluidos",
      memberDiscount: (pct) => `Incluye su descuento del plan del ${pct} %`,
      included: "Qué incluye",
      nextDates: "Próximas fechas",
      endsOn: (date) => `El plan dura hasta el ${date}`,
      visitsSold: (n) => (n === 1 ? "1 visita en este plan" : `${n} visitas en este plan`),
      reschedule: "Pedir otra fecha",
      skip: "Saltar esta visita",
      rescheduleQuestion: "¿Qué le vendría mejor?",
      skipQuestion: "¿Algo que debamos saber? (opcional)",
      requestPlaceholder: "Por ejemplo: cualquier día entre semana después del 20",
      requestExplain: (company) => `${company} le responderá. Nada cambia hasta que lo confirmen.`,
      requestSend: "Enviar solicitud",
      cancel: "Cancelar",
      requested: "Solicitud enviada",
      requestTooLate: "Esta visita está demasiado cerca para cambiarla aquí. Por favor, llame.",
      requestFailed: "No se pudo enviar su solicitud. Inténtelo de nuevo o llame.",
      callToChange: "Falta menos de un día. Llame para cambiarla.",
      photoAlt: "Foto de esta visita",
      loginEmailSubject: (company) => `Su cuenta con ${company}`,
      loginEmailLabel: "Su cuenta",
      loginEmailGreeting: (first) => (first ? `Hola, ${first}:` : "Hola:"),
      loginEmailIntro: (company) => `Este es el enlace a su cuenta con ${company}: sus presupuestos, facturas, visitas y planes en un solo lugar.`,
      loginEmailButton: "Abrir su cuenta",
      loginEmailKeep: "Este enlace es personal. No lo comparta y guárdelo en favoritos para volver cuando quiera.",
      loginEmailIgnore: "Si no pidió este enlace, puede ignorar este correo. Nada ha cambiado en su cuenta.",
      rescheduleSubject: (what, date) => `Cambiar ${what} del ${date}`,
      skipSubject: (what, date) => `Saltar ${what} del ${date}`,
      requestNoMessage: "Sin mensaje — por favor propongan otra fecha.",
      maintenanceSubject: (plan) => `Reservar mi próxima visita — ${plan}`,
      preferredLine: (when) => `Me viene bien: ${when}`,
      maintenanceNoNote: "Por favor propongan una fecha para mi próxima visita incluida.",
      ticketReplySubject: (subject) => `Re: ${subject}`,
      ticketReplyIntro: (who, subject) => `${who} respondió sobre «${subject}»:`,
      ticketReplyButton: "Ver y responder",
      ticketEmailLabel: "Su solicitud",
      tickets: {
        heading: "Sus solicitudes",
        reportIssue: "Informar un problema",
        requestWork: "Solicitar trabajo",
        reportOnVisit: "Informar un problema",
        reportTitle: "Informar un problema",
        aboutVisit: (date) => `Sobre la visita del ${date}`,
        typeLabel: "¿De qué se trata?",
        types: {
          repair: "Algo que reparar",
          warranty: "Reclamo de garantía",
          question: "Una pregunta",
          billing: "Facturación",
          reschedule: "Cambiar una fecha",
          maintenance: "Visita de mantenimiento",
        },
        subjectLabel: "Resumen breve",
        bodyLabel: "Cuéntenos qué pasa",
        photosLabel: "Fotos (opcional)",
        addPhoto: "Añadir una foto",
        uploading: "Subiendo…",
        uploadFailed: "No se pudo subir esa foto.",
        send: "Enviar",
        cancel: "Cancelar",
        sent: (company) => `Enviado. ${company} le responderá aquí y por correo.`,
        failed: "No se pudo enviar. Inténtelo de nuevo.",
        status: {
          open: "Recibida",
          in_progress: "En curso",
          waiting_on_client: "Esperando su respuesta",
          resolved: "Resuelta",
          closed: "Cerrada",
        },
        you: "Usted",
        replyPlaceholder: "Escriba una respuesta…",
        sendReply: "Enviar respuesta",
        closedNote: "Esta solicitud está cerrada. Informe un nuevo problema si surge algo más.",
        workTitle: "Solicitar trabajo",
        workNewJob: "Un trabajo nuevo o presupuesto",
        workMaintenance: "Una visita de mantenimiento",
        workService: "¿Qué servicio?",
        workServiceOther: "Otra cosa",
        workDescribe: "Describa el trabajo",
        workDates: "Fechas preferidas (opcional)",
        workDatesPlaceholder: "Por ejemplo: cualquier día entre semana a principios de noviembre",
        workSent: (company) => `Enviado. ${company} se pondrá en contacto para confirmar. Nada se reserva ni se cobra hasta entonces.`,
        workPlan: "¿Qué plan?",
        workRemaining: (n) => (n === 1 ? "Queda 1 visita incluida" : `Quedan ${n} visitas incluidas`),
        workUntilCancelled: "Las visitas continúan hasta que termine el plan",
        workWindow: "¿Cuándo le viene bien?",
        workWindowPlaceholder: "Por ejemplo: por la mañana, la semana del 10",
        workNote: "¿Algo más? (opcional)",
        workSetupIntro: (company) => `Aún no tiene un plan de mantenimiento. Dígale a ${company} qué le gustaría que se revise regularmente y con qué frecuencia, y le propondrán opciones.`,
        workSetupDescribe: "¿Qué hay que mantener y con qué frecuencia?",
        workConfirmNote: (company) => `${company} confirma todo antes de reservar. Desde aquí no se agenda ni se cobra nada.`,
      },
    },

    job: {
      kicker: "Su trabajo",
      dayOf: (day, total) => `Día ${day} de ${total}`,
      onSchedule: "a tiempo",
      runningLate: "con retraso",
      finished: "Terminado",
      started: (date) => `Comenzó el ${date}`,
      finishPlanned: (date) => `Fin previsto el ${date}`,
      datesToConfirm: "Fechas por confirmar",
      done: "Hecho",
      inProgress: "En curso",
      waitingOn: "En espera de",
      upNext: "A continuación",
      photos: (n) => (n === 1 ? "1 foto" : `${n} fotos`),
      onSiteSince: (names, time) => `${names} en la obra desde las ${time}`,
      photoAdded: (time) => `Foto añadida a las ${time}`,
      today: "Hoy",
      waitingOnStep: (title) => `En espera de: ${title}`,
      waitingOnExternal: (reason) => `En espera de: ${reason}`,
      waitingOnApproval: (label) => `En espera de su aprobación de la orden de cambio ${label}`,
      waitingOnYou: "Pendiente de usted",
      reviewAndSign: "Revisar y firmar",
      datesNote: "Las fechas son el plan del equipo y pueden cambiar.",
      changesHeading: "Cambios pendientes de su aprobación",
      approvedChange: (label, date) => `${label} aprobada el ${date}`,
      stepsDone: (done, total) => `${done} de ${total} pasos hechos`,
    },

    changeOrder: {
      kicker: "Orden de cambio",
      toQuote: (number) => `al presupuesto ${number}`,
      forClient: (name) => `Para ${name}`,
      originalLine: "Línea original",
      theChange: "El cambio",
      photo: (when) => `Foto · ${when}`,
      quoteTotalAsApproved: (date) => (date ? `Total del presupuesto aprobado el ${date}` : "Total del presupuesto aprobado"),
      priorChanges: "Cambios ya aprobados",
      thisChange: "Este cambio",
      taxOnChange: (rate) => `Impuesto del ${rate} sobre el cambio`,
      taxUnknown: "El impuesto de este cambio no se muestra aquí; su factura lo indicará a la tasa del presupuesto.",
      newTotal: "Nuevo total",
      schedule: "Calendario",
      finishMoves: (from, to, days) => `El fin pasa del ${from} al ${to} (${days})`,
      finishMovesBy: (days) => `El fin se mueve ${days}`,
      days: (n) => (n === 1 || n === -1 ? `${n > 0 ? "+" : "−"}1 día` : `${n > 0 ? "+" : "−"}${Math.abs(n)} días`),
      scheduleUnchanged: "Sin cambios en el calendario",
      consent: (amount, total) => `Apruebo este cambio por ${amount} con impuestos incluidos, con lo que el nuevo total es ${total}.`,
      consentSchedule: (days) => ` También apruebo el cambio de calendario (${days}).`,
      approveAndSign: "Aprobar y firmar",
      askQuestion: "Hacer una pregunta",
      footer: (company, phone) => `El presupuesto original que firmó no cambia; este anexo se añade a él. ¿Preguntas? Responda al mensaje o llame a ${company}${phone ? ` al ${phone}` : ""}.`,
      approvedTitle: "Aprobado — gracias",
      approvedBody: (company) => `${company} tiene su aprobación firmada y seguirá adelante con el cambio.`,
      approvedOn: (date) => `Aprobado el ${date}.`,
      withdrawnTitle: "Este cambio fue retirado",
      withdrawnBody: (company) => `${company} retiró esta orden de cambio. Nada cambia en su presupuesto.`,
      notFound: "Este enlace no es válido.",
      notFoundBody: "Póngase en contacto con la empresa con la que trabaja y le enviarán uno nuevo.",
      signFailed: "No se pudo registrar su aprobación ahora mismo. Inténtelo de nuevo en un momento.",
      emailSubject: (label, company) => `${label} de ${company} — revise y firme`,
      emailIntro: (name, label, number) => `Hola ${name}, hay un cambio en su trabajo (${label}${number ? `, presupuesto ${number}` : ""}) que necesita su aprobación antes de continuar.`,
      emailButton: "Revisar y firmar",
      emailFooter: "Nada cambia en su presupuesto ni en su factura hasta que firme.",
      smsText: (company, label, url) => `${company}: la orden de cambio ${label} de su trabajo necesita su aprobación — revise y firme aquí: ${url}`,
    },

    selfQuote: {
      documentWord: "Solicitud",
      eyebrow: "Solicitar un presupuesto",
      languageLabel: "Idioma",

      step1Title: "¿En qué podemos ayudarle?",
      step1Hint:
        "Elija lo más parecido — los detalles los concretamos nosotros.",
      noServices: (phone) =>
        `Esta empresa aún no ha configurado sus servicios. Comuníquese directamente con ella${phone ? ` al ${phone}` : ""}.`,

      step2Hint: "Cifras aproximadas bastan — nada de esto es vinculante.",
      designKitchen: "¿Prefiere dibujarla? Diseñe su cocina usted mismo y envíenos el plano →",
      timelineLabel: "¿Cuándo espera empezar?",
      timelineAsap: "Lo antes posible",
      timeline2Weeks: "En 2 semanas",
      timeline1To3Months: "En los próximos 1 a 3 meses",
      timelineExploring: "Solo estoy consultando",
      budgetLabel: "¿Presupuesto aproximado?",
      optional: "(opcional)",
      budgetUnder: (s) => `Menos de ${s}1.000`,
      budgetLow: (s) => `${s}1.000 – ${s}5.000`,
      budgetMid: (s) => `${s}5.000 – ${s}15.000`,
      budgetHigh: (s) => `${s}15.000 o más`,
      budgetUnsure: "Todavía no lo sé",
      notesLabel: "¿Algo más que debamos saber?",
      notesPlaceholder:
        "Fotos, fechas, acceso, cualquier cosa fuera de lo común…",
      continueCta: "Continuar",

      step3Title: "¿Adónde se lo enviamos?",
      step3Hint: "Con un correo o un teléfono es suficiente.",
      namePlaceholder: "Su nombre",
      emailPlaceholder: "Correo electrónico",
      phonePlaceholder: "Teléfono",
      addressPlaceholder: "¿Dónde es el trabajo?",
      errAddress: "Indícanos la dirección del trabajo.",

      uploadLabel: "Añadir fotos, un video o un plano PDF",
      uploadHint:
        "Una foto, un clip corto o su plano PDF nos ayuda a cotizar con precisión.",
      uploadDocumentFallback: "Plano PDF",
      uploadBusy: "Subiendo…",
      uploadLimit: (n) => `Puede adjuntar hasta ${n} archivos.`,
      uploadFailed:
        "Error al subir: compruebe su conexión y vuelva a intentarlo.",
      uploadRejected: "No se pudo subir ese archivo.",
      uploadTooLarge: (size, limit) => `Ese archivo pesa ${size}; el máximo por envío es ${limit}. Tome la foto en un tamaño menor, o redimensiónela y vuelva a intentarlo.`,
      uploadRemove: "Quitar",
      back: "Atrás",
      sendCta: "Enviar mi solicitud",
      noObligation: (company) =>
        `Sin compromiso. ${company} le responderá con un precio.`,

      errName: "Díganos su nombre, por favor.",
      errContact:
        "Añada un correo electrónico o un teléfono para que podamos responderle.",
      errSend: "No se pudo enviar su solicitud.",
      linkInvalid: "Este enlace no es válido.",
      linkInvalidHint:
        "Revise el enlace o comuníquese directamente con la empresa.",

      confirmTitle: "Solicitud recibida",
      confirmIntro: (company) =>
        `${company} tiene todo lo siguiente y le responderá con un precio.`,
      requestedHeading: "Lo que solicitó",
      nextHeading: "Qué pasa ahora",
      next1Title: "La leen",
      next1Body:
        "Sus respuestas llegan a la empresa de inmediato, junto con lo que haya adjuntado.",
      next2Title: "Calculan el precio",
      next2Body:
        "Una persona calcula el costo real de su trabajo — aquí nada se ha presupuestado automáticamente.",
      next3Title: "Recibe un presupuesto",
      next3Body:
        "Llega como un documento que puede leer, cuestionar y aprobar. Nada se acuerda hasta entonces.",
      estimateLabel: "Rango estimado",
      beforeTax: "antes de impuestos",
      gatedNote:
        "Todavía no se muestra ningún precio — esta solicitud no se ha presupuestado. Es a propósito: la cifra que reciba será una que una persona respalda.",
      submittedLabel: "Enviada el",
      copySentTo: (email) => `Una copia va en camino a ${email}.`,
      callInstead: "¿Lo necesita antes?",
      // The in-person visit offered under the confirmation. Only rendered when
      // the company can actually take a booking — see lib/booking/canBookVisit.js.
      bookVisitTitle: "¿Quiere que vayamos a verlo?",
      bookVisitBody: "Reserve una visita y confirmamos su precio en el lugar.",
      bookVisitCta: "Reservar una visita",

      emailSubject: (company) => `Su solicitud a ${company}`,
      emailIntro: (company) =>
        `Gracias — ${company} ha recibido su solicitud. Esto es lo que envió, para sus registros.`,
    },

    visit: {
      eyebrow: "Su visita",
      loadFailed: "No pudimos cargar su visita.",
      loadFailedHint:
        "Revise el enlace de su correo, o póngase en contacto directamente con la empresa.",

      aboutEstimate: (number) => `Sobre su presupuesto ${number}`,

      whenLabel: "Cuándo",
      whereLabel: "Dónde",
      modeVisit: "Vamos a su domicilio",
      modeCall: "Llamada telefónica — le llamaremos",
      modeVideo: "Videollamada — le enviaremos un enlace por correo",
      addressUnknown: "Dirección por confirmar",
      depositPaid: (amount) => `Depósito de ${amount} pagado`,

      changeHeading: "¿Necesita cambiar algo?",
      rescheduleCta: "Cambiar la hora",
      cancelCta: "Cancelar esta visita",

      cannotCancelled: "Esta visita ya fue cancelada.",
      cannotHappened: "Esta visita ya tuvo lugar.",
      cannotAwaitingPayment:
        "Esta visita aún no está confirmada — el pago no se ha completado.",
      cannotNotFound: "Este enlace no corresponde a ninguna visita.",
      cannotTooLate: (notice, company) =>
        `${company} pide un aviso de al menos ${notice}, así que esta visita ya no se puede cambiar aquí.`,
      cannotTooLateNoNotice: (company) =>
        `Ya falta muy poco para su cita como para que ${company} acepte un cambio aquí.`,
      noticeHours: (n) => (n === 1 ? "1 hora" : `${n} horas`),
      callInstead: (company, phone) =>
        phone
          ? `Llame a ${company} al ${phone} — todavía pueden moverla por usted.`
          : `Póngase en contacto con ${company} — todavía pueden moverla por usted.`,

      refundYes: (amount) =>
        `Su depósito de ${amount} se devolverá a la tarjeta con la que pagó.`,
      refundNo: (amount) =>
        `Su depósito de ${amount} no se devuelve automáticamente — póngase en contacto con ellos al respecto.`,
      refundAlready: (amount) => `Su depósito de ${amount} ya fue devuelto.`,

      cancelConfirmTitle: "¿Cancelar esta visita?",
      cancelConfirmBody: (company) =>
        `Se avisará a ${company} de inmediato y su hora volverá a quedar libre.`,
      yesCancel: "Sí, cancelar",
      keepIt: "Mantener mi visita",
      cancelledTitle: "Visita cancelada",
      cancelledBody: (company) =>
        `Se ha avisado a ${company}. Si fue un error, póngase en contacto y le buscarán otra hora.`,
      cancelledRefunded: (amount) =>
        `Su depósito de ${amount} está en camino de vuelta. Puede tardar unos días en aparecer en su extracto.`,

      rescheduleTitle: "Elija una nueva hora",
      rescheduleKeep: "Mantener mi hora actual",
      findingTimes: "Buscando horas…",
      timesFailed: "No pudimos cargar las horas disponibles en este momento.",
      pickADay: "Elija un día para ver las horas.",
      morning: "Mañana",
      afternoon: "Tarde",
      evening: "Noche",
      nothingThisMonth: "No hay nada libre este mes.",
      tryNextMonth: "Probar el mes que viene",
      prevMonth: "Mes anterior",
      nextMonth: "Mes siguiente",
      confirmNewTime: "Mover mi visita aquí",
      movedTitle: "Su visita se ha movido",
      movedBody: (company) =>
        `Se ha avisado a ${company}, y le llegará una nueva confirmación.`,

      questions: (company, phone) =>
        phone
          ? `¿Preguntas? Llame a ${company} al ${phone}.`
          : `¿Preguntas? Póngase en contacto con ${company}.`,

      slotTaken: "Esa hora acaba de ocuparse. Elija otra.",
      tooSoon: "Esa hora no les da aviso suficiente. Elija una más tarde.",
      refundFailed:
        "No pudimos devolver su depósito en este momento, así que no se ha cancelado nada. Inténtelo de nuevo en un momento, o póngase en contacto con ellos.",
    },
  },

  uk: {
    // "See the property" on /q/[token] — app/components/StreetViewPeek.js.
    streetView: { see: "Переглянути об'єкт", hide: "Сховати", openInMaps: "Відкрити в Google Картах", frameTitle: "Street View об'єкта" },
    portalDocumentsHeading: "Документи",

    proposal: {
      contents: "Зміст",
      yourProject: "Ваш проєкт",
      aboutUs: "Про нас",
      beforeAfter: "До і після",
      importantDocuments: "Важливі документи",
      testimonials: "Відгуки",
      services: "Послуги",
      scopeOfWork: "Обсяг робіт",
      priceByArea: "Ціна за зонами",
      quoteTotal: "Сума кошторису",
      acceptQuote: "Прийняти кошторис",
      day: (n) => `День ${n}`,
      crewOf: (n) => `Бригада з ${n}`,
      halfDay: "Півдня",
      paintLine: (products, coats) =>
        products && coats ? `Фарба: ${products} · ${coats}` : products ? `Фарба: ${products}` : coats,
      coats: (n) => (n === 1 ? "1 шар" : `${n} шари(ів)`),
      viewDocument: "Переглянути документ →",
      before: "До",
      after: "Після",
      recentWork: "Нещодавні роботи",
      documentsHeading: "Сертифікати та документи",
      whatClientsSaid: "Що кажуть клієнти",
      whatElseWeDo: "Що ще ми робимо",
      watchVideo: "Подивитися наше відео",
      teamPhotoAlt: "Наша команда",
    },
    // ── /estimate-report/[token] — the instant estimate as a proposal ─────
    // The same presentation as the quote, with the RANGE where the prices
    // would be (app/estimate-report/[token]/ReportView.js).
    rangeProposal: {
      yourEstimate: "Ваш кошторис",
      estimateWord: "Кошторис",
      estimatedRange: "Орієнтовний діапазон",
      subjectToVisit: "Кошторис — остаточно після огляду на місці",
      rangeFor: (option) => `Для: ${option}`,
      rangeNote: (company) => `На основі наданих вами даних. ${company} підтверджує остаточну ціну після огляду робіт на місці — нічого не є обов'язковим, доки ви не схвалите пропозицію.`,
      noRange: (company) => `${company} підтвердить вашу ціну після огляду на місці.`,
      whatHappensNext: "Що далі",
      bookVisit: "Записатися на огляд",
      talkToUs: "Зв'язатися з нами",
    },
    waiverKicker: "Відмова від відповідальності",
    waiverAttachedTo: (ref) => `Додано до ${ref}`,
    waiverIntro: "Прочитайте кожен розділ і поставте позначку, що ви його зрозуміли. Підпис — наприкінці.",
    waiverAcknowledgements: "Підтвердження",
    waiverSign: "Підписати",
    waiverAcknowledged: (n, total) => `Підтверджено ${n} з ${total}`,
    signWaiver: "Підписати документ",
    waiverTickRemaining: (n) =>
      n === 1 ? "Поставте позначку в останньому пункті, щоб підписати." : `Поставте позначки в ${n} пунктах, що залишилися, щоб підписати.`,
    waiverConsent: "Я погоджуюся, що підпис тут є моїм електронним підписом і що я прочитав(ла) і приймаю цей документ.",
    waiverSignedTitle: "Документ підписано — дякуємо",
    waiverSignedBody: (company) => `Копію надіслано вам і збережено у ${company}.`,
    waiverSignedOn: (date) => `Підписано ${date}`,
    waiverSignedBy: (name, date) => `Підписав(ла) ${name}, ${date}`,
    waiverAfterNote: "Після підписання копію з датою, вашим ім'ям і кожним підтвердженням буде надіслано вам і збережено в цьому замовленні. Кошторис підписується окремо.",
    waiverRequiredBeforeApprove: "Підпишіть доданий документ перед тим, як схвалити кошторис.",
    waiverCopyIntro: (company) => `Ваша підписана копія документа для ${company} у вкладенні.`,
    waiverLinkIntro: (company, title) => `${company} має документ, який потрібно прочитати й підписати: «${title}». Це займе хвилину.`,
    waiverOpen: "Прочитати й підписати",
    approveThisQuote: "Підтвердити цей кошторис",
    decline: "Відхилити",
    whatsIncluded: "Що входить",
    whatCouldChange: "Що може змінити цю ціну",
    termsExplained: "Терміни в цій пропозиції, пояснені",
    optionalExtras: "Додаткові опції",
    extrasTickHint:
      "Позначте те, що бажаєте додати. Підсумок оновлюється відразу — нічого не стягується до вашого підтвердження.",
    extrasChosen: "Обрано під час підтвердження цього кошторису.",
    includesOptionalExtras: "Містить додаткові опції",
    payOfflineHint: "Ви оплатите e-Transfer або чеком замість картки.",
    howTheWorkRuns: "Як виконуються роботи",
    paymentTerms: "Умови оплати",
    yourFullName: "Ваше повне ім'я",
    typeYourName: "Введіть ваше ім'я",
    signature: "Підпис",
    signatureConsent: (total) =>
      `Я погоджуюся, що підпис тут є моїм електронним підписом і підтверджує цей кошторис на суму ${total}.`,
    approveConfirm: (total) => `Підтвердити цей кошторис на ${total}?`,
    declineConfirm: "Відхилити цей кошторис?",
    approveSubExtras: (extras) =>
      `Включно з ${extras} додаткових опцій. Це дає їм сигнал розпочинати.`,
    approveSubPlain: "Це дає їм сигнал розпочинати.",
    declineSub: "Ви завжди можете попросити оновлений кошторис.",
    yesApprove: "Так, підтвердити",
    yesDecline: "Так, відхилити",
    goBack: "Назад",
    approvedTitle: "Підтверджено — дякуємо",
    approvedBody: (company) =>
      `${company} сповіщено, і з вами зв'яжуться щодо наступних кроків.`,
    declinedTitle: "Кошторис відхилено",
    declinedBody: (company) =>
      `${company} сповіщено. Якщо це помилка, зателефонуйте їм.`,
    expiredTitle: "Термін дії цього кошторису минув",
    expiredBody: (company) =>
      `Зв'яжіться з ${company}, щоб отримати оновлену ціну.`,
    approvedCopyIntro: (company) =>
      `Дякуємо за підтвердження кошторису з ${company}. Копію додано для ваших записів.`,
    measuredAt: (address) => `Виміряно за адресою: ${address}`,
    genericError: "Щось пішло не так. Спробуйте ще раз.",
    connectionLost: "Не вдалося завантажити вашу пропозицію.",
    connectionLostHint:
      "Можливо, зник сигнал. Перевірте з'єднання та спробуйте ще раз — нічого не надіслано.",
    tryAgain: "Спробувати ще раз",
    linkInvalidHint:
      "Зв'яжіться з компанією, яка її надіслала, і вам нададуть нове посилання.",

    financingAvailable: "Фінансування",
    financingHeading: "Оплата щомісяця",
    financingMonthly: (monthly) => `Приблизно ${monthly} на місяць`,
    financingTermsLine: (months, apr) =>
      `Орієнтовно на ${months} міс. за річною ставкою ${apr}.`,
    financingEstimateNote: (company) =>
      `Це лише орієнтовний розрахунок за умовами, які вказала компанія ${company}, і за сумою вище. Фактичну ставку, платіж і схвалення підтверджує кредитна установа під час подання заявки.`,
    financingCta: "Переглянути варіанти фінансування",
    quoteQuestions: (company, phone) =>
      phone
        ? `Питання? Відповідайте на лист або телефонуйте ${company}: ${phone}.`
        : `Питання? Відповідайте на лист або телефонуйте ${company}.`,

    accountFor: (name) => `Рахунок для ${name}`,
    balanceOwing: "Залишок до сплати",
    nothingOutstanding: "Немає заборгованості. Дякуємо.",
    acrossInvoices: (n) => `За ${n} рахунками.`,
    invoicesHeading: "Рахунки",
    quotesHeading: "Кошториси",
    paidNote: (amount) => `сплачено ${amount}`,
    dueNote: (date) => `термін ${date}`,
    pay: (amount) => `Сплатити ${amount}`,
    paid: "Сплачено",
    review: "Переглянути",
    // Keyed by the QuoteStatus enum — see the note in the `en` block.
    quoteStatus: {
      draft: "Чернетка",
      sent: "Очікує вашої відповіді",
      accepted: "Підтверджено",
      declined: "Відхилено",
    },
    paymentReceived:
      "Платіж отримано — дякуємо. Його відображення нижче може зайняти хвилину.",
    payCard: (amount) => `Сплатити ${amount} карткою`,
    payBank: (amount) => `Сплатити ${amount} з банківського рахунку`,
    bankNote: "Банківський платіж проходить 3–5 робочих днів. До того часу рахунок показується як очікуваний.",
    bankPendingBanner: "Банківський платіж отримано — він проходить 3–5 робочих днів. Після цього рахунок показуватиметься як оплачений.",
    bankPending: "Банківський платіж очікується",
    bankFailed: (reason) => `Банківський платіж не пройшов${reason ? ` — ${reason}` : ""}. Спробуйте ще раз або сплатіть карткою.`,
    bankOverCap: (max, amount) => `Банківське списання доступне до ${max} за один платіж — цей рахунок на ${amount}, тож лише карткою.`,
    paymentNotStarted: (company) => `Не вдалося розпочати цей платіж — спробуйте карткою або зверніться до ${company}.`,
    portalQuestions: (company, phone, email) =>
      `Питання щодо цього? Зв'яжіться з ${company}${phone ? `: ${phone}` : ""}${email ? ` · ${email}` : ""}.`,

    backToAccount: "Назад до вашого рахунку",
    due: "Термін оплати",
    wasDue: "Термін минув",
    noItemisedBreakdown: "У цьому рахунку немає деталізації.",
    paidInFull: "Сплачено повністю",
    paidInFullThanks: "Сплачено повністю — дякуємо",
    invoiceNotFound: "Цього рахунку немає у вашому обліковому записі.",
    arrangePayment: "Будь ласка, зв’яжіться з нами, щоб домовитися про оплату.",
    acceptedMethods: (methods) => `Приймаємо: ${methods}.`,

    portal: {
      nextVisitKicker: "Наступний візит",
      planKicker: "Ваш план",
      upcomingHeading: "Майбутні візити",
      pastHeading: "Минулі візити",
      between: (from, to) => `між ${from} і ${to}`,
      at: (time) => `о ${time}`,
      withCrew: (name) => `Виконавець: ${name}`,
      typeVisit: "Візит",
      typeReturn: "Повторний візит",
      typeAppointment: "Зустріч",
      typeCall: "Телефонний дзвінок",
      typeVideo: "Відеодзвінок",
      frequency: {
        weekly: "Щотижня",
        monthly: "Щомісяця",
        quarterly: "Кожні 3 місяці",
        semiannual: "Двічі на рік",
        annual: "Раз на рік",
      },
      perVisit: (amount) => `${amount} за візит`,
      taxIncluded: "з податком",
      memberDiscount: (pct) => `Включає вашу знижку за планом ${pct}%`,
      included: "Що входить",
      nextDates: "Наступні дати",
      endsOn: (date) => `План діє до ${date}`,
      visitsSold: (n) => `Візитів у цьому плані: ${n}`,
      reschedule: "Попросити перенести",
      skip: "Пропустити цей візит",
      rescheduleQuestion: "Який час вам зручніший?",
      skipQuestion: "Щось, що нам варто знати? (необов'язково)",
      requestPlaceholder: "Наприклад: будь-який будній день після 20-го",
      requestExplain: (company) => `${company} зв'яжеться з вами. Нічого не зміниться, доки вони не підтвердять.`,
      requestSend: "Надіслати запит",
      cancel: "Скасувати",
      requested: "Запит надіслано",
      requestTooLate: "Цей візит надто близько, щоб змінити його тут. Будь ласка, зателефонуйте.",
      requestFailed: "Не вдалося надіслати запит. Спробуйте ще раз або зателефонуйте.",
      callToChange: "Менше ніж за добу. Зателефонуйте, щоб змінити.",
      photoAlt: "Фото з цього візиту",
      loginEmailSubject: (company) => `Ваш обліковий запис у ${company}`,
      loginEmailLabel: "Ваш обліковий запис",
      loginEmailGreeting: (first) => (first ? `Вітаємо, ${first}!` : "Вітаємо!"),
      loginEmailIntro: (company) => `Ось посилання на ваш обліковий запис у ${company}: кошториси, рахунки, візити та плани в одному місці.`,
      loginEmailButton: "Відкрити обліковий запис",
      loginEmailKeep: "Це посилання особисте. Не передавайте його іншим і додайте в закладки, щоб повертатися будь-коли.",
      loginEmailIgnore: "Якщо ви не просили це посилання, просто проігноруйте цей лист. У вашому обліковому записі нічого не змінилося.",
      rescheduleSubject: (what, date) => `Перенести: ${what}, ${date}`,
      skipSubject: (what, date) => `Пропустити: ${what}, ${date}`,
      requestNoMessage: "Без повідомлення — будь ласка, запропонуйте іншу дату.",
      maintenanceSubject: (plan) => `Записатися на наступний візит — ${plan}`,
      preferredLine: (when) => `Мені зручно: ${when}`,
      maintenanceNoNote: "Будь ласка, запропонуйте дату мого наступного включеного візиту.",
      ticketReplySubject: (subject) => `Re: ${subject}`,
      ticketReplyIntro: (who, subject) => `${who} відповідає щодо «${subject}»:`,
      ticketReplyButton: "Переглянути й відповісти",
      ticketEmailLabel: "Ваш запит",
      tickets: {
        heading: "Ваші запити",
        reportIssue: "Повідомити про проблему",
        requestWork: "Замовити роботу",
        reportOnVisit: "Повідомити про проблему",
        reportTitle: "Повідомити про проблему",
        aboutVisit: (date) => `Щодо візиту ${date}`,
        typeLabel: "Про що йдеться?",
        types: {
          repair: "Щось треба полагодити",
          warranty: "Гарантійна претензія",
          question: "Запитання",
          billing: "Оплата",
          reschedule: "Змінити дату",
          maintenance: "Візит з обслуговування",
        },
        subjectLabel: "Короткий опис",
        bodyLabel: "Розкажіть, що сталося",
        photosLabel: "Фото (необов'язково)",
        addPhoto: "Додати фото",
        uploading: "Завантаження…",
        uploadFailed: "Не вдалося завантажити це фото.",
        send: "Надіслати",
        cancel: "Скасувати",
        sent: (company) => `Надіслано. ${company} відповість тут і електронною поштою.`,
        failed: "Не вдалося надіслати. Спробуйте ще раз.",
        status: {
          open: "Отримано",
          in_progress: "У роботі",
          waiting_on_client: "Чекаємо на вас",
          resolved: "Вирішено",
          closed: "Закрито",
        },
        you: "Ви",
        replyPlaceholder: "Напишіть відповідь…",
        sendReply: "Надіслати відповідь",
        closedNote: "Цей запит закрито. Якщо з'явиться щось інше, повідомте про нову проблему.",
        workTitle: "Замовити роботу",
        workNewJob: "Нова робота або кошторис",
        workMaintenance: "Візит з обслуговування",
        workService: "Яка послуга?",
        workServiceOther: "Щось інше",
        workDescribe: "Опишіть роботу",
        workDates: "Бажані дати (необов'язково)",
        workDatesPlaceholder: "Наприклад: будь-який будній день на початку листопада",
        workSent: (company) => `Надіслано. ${company} зв'яжеться з вами для підтвердження. До того нічого не записано й не оплачено.`,
        workPlan: "Який план?",
        workRemaining: (n) => `Залишилось включених візитів: ${n}`,
        workUntilCancelled: "Візити тривають до завершення плану",
        workWindow: "Коли вам зручно?",
        workWindowPlaceholder: "Наприклад: зранку, тиждень 10-го",
        workNote: "Ще щось? (необов'язково)",
        workSetupIntro: (company) => `У вас ще немає плану обслуговування. Напишіть ${company}, що ви хочете регулярно обслуговувати і як часто, — вам запропонують варіанти.`,
        workSetupDescribe: "Що треба обслуговувати і як часто?",
        workConfirmNote: (company) => `${company} підтверджує все перед записом. Звідси нічого не планується й не оплачується.`,
      },
    },

    job: {
      kicker: "Ваша робота",
      dayOf: (day, total) => `День ${day} з ${total}`,
      onSchedule: "за графіком",
      runningLate: "із затримкою",
      finished: "Завершено",
      started: (date) => `Розпочато ${date}`,
      finishPlanned: (date) => `Завершення заплановано на ${date}`,
      datesToConfirm: "Дати уточнюються",
      done: "Виконано",
      inProgress: "Виконується",
      waitingOn: "Очікує на",
      upNext: "Далі",
      photos: (n) => (n === 1 ? "1 фото" : `${n} фото`),
      onSiteSince: (names, time) => `${names} на об'єкті з ${time}`,
      photoAdded: (time) => `Фото додано о ${time}`,
      today: "Сьогодні",
      waitingOnStep: (title) => `Очікує на: ${title}`,
      waitingOnExternal: (reason) => `Очікує на: ${reason}`,
      waitingOnApproval: (label) => `Очікує на ваше погодження зміни ${label}`,
      waitingOnYou: "Очікує на вас",
      reviewAndSign: "Переглянути й підписати",
      datesNote: "Дати — це план бригади, і вони можуть змінюватися.",
      changesHeading: "Зміни, що очікують на ваше погодження",
      approvedChange: (label, date) => `${label} погоджено ${date}`,
      stepsDone: (done, total) => `Виконано ${done} з ${total} кроків`,
    },

    changeOrder: {
      kicker: "Зміна до замовлення",
      toQuote: (number) => `до кошторису ${number}`,
      forClient: (name) => `Для ${name}`,
      originalLine: "Початкова позиція",
      theChange: "Зміна",
      photo: (when) => `Фото · ${when}`,
      quoteTotalAsApproved: (date) => (date ? `Сума кошторису, погодженого ${date}` : "Сума погодженого кошторису"),
      priorChanges: "Уже погоджені зміни",
      thisChange: "Ця зміна",
      taxOnChange: (rate) => `Податок ${rate} на зміну`,
      taxUnknown: "Податок на цю зміну тут не показано; рахунок укаже його за ставкою кошторису.",
      newTotal: "Нова сума",
      schedule: "Графік",
      finishMoves: (from, to, days) => `Завершення переноситься з ${from} на ${to} (${days})`,
      finishMovesBy: (days) => `Завершення переноситься на ${days}`,
      days: (n) => `${n > 0 ? "+" : "−"}${Math.abs(n)} дн.`,
      scheduleUnchanged: "Графік не змінюється",
      consent: (amount, total) => `Я погоджую цю зміну на ${amount} з податком, після чого нова сума становить ${total}.`,
      consentSchedule: (days) => ` Я також погоджую зміну графіка (${days}).`,
      approveAndSign: "Погодити й підписати",
      askQuestion: "Поставити запитання",
      footer: (company, phone) => `Підписаний вами кошторис не змінюється; цей додаток долучається до нього. Є запитання? Дайте відповідь на повідомлення або зателефонуйте ${company}${phone ? ` за номером ${phone}` : ""}.`,
      approvedTitle: "Погоджено — дякуємо",
      approvedBody: (company) => `${company} отримала ваше підписане погодження і продовжить роботу над зміною.`,
      approvedOn: (date) => `Погоджено ${date}.`,
      withdrawnTitle: "Цю зміну відкликано",
      withdrawnBody: (company) => `${company} відкликала цю зміну. Ваш кошторис залишається без змін.`,
      notFound: "Це посилання недійсне.",
      notFoundBody: "Зв'яжіться з компанією, з якою ви працюєте, і вона надішле нове.",
      signFailed: "Не вдалося зберегти ваше погодження. Спробуйте ще раз за хвилину.",
      emailSubject: (label, company) => `${label} від ${company} — перегляньте й підпишіть`,
      emailIntro: (name, label, number) => `Вітаємо, ${name}! У вашій роботі є зміна (${label}${number ? `, кошторис ${number}` : ""}), яку потрібно погодити, перш ніж роботи продовжаться.`,
      emailButton: "Переглянути й підписати",
      emailFooter: "Ваш кошторис і рахунок не змінюються, доки ви не підпишете.",
      smsText: (company, label, url) => `${company}: зміна ${label} до вашої роботи потребує погодження — перегляньте й підпишіть тут: ${url}`,
    },

    selfQuote: {
      documentWord: "Запит",
      eyebrow: "Запросити кошторис",
      languageLabel: "Мова",

      step1Title: "Чим ми можемо допомогти?",
      step1Hint: "Оберіть найближче — деталі ми уточнимо.",
      noServices: (phone) =>
        `Ця компанія ще не налаштувала свої послуги. Зверніться до неї безпосередньо${phone ? ` за номером ${phone}` : ""}.`,

      step2Hint: "Приблизних цифр достатньо — ніщо тут не є зобов'язанням.",
      designKitchen: "Хочете накреслити самі? Спроєктуйте свою кухню й надішліть нам план →",
      timelineLabel: "Коли плануєте почати?",
      timelineAsap: "Якнайшвидше",
      timeline2Weeks: "Протягом 2 тижнів",
      timeline1To3Months: "Через 1–3 місяці",
      timelineExploring: "Поки що просто дізнаюся",
      budgetLabel: "Орієнтовний бюджет?",
      optional: "(необов'язково)",
      budgetUnder: (s) => `Менше ${s}1 000`,
      budgetLow: (s) => `${s}1 000 – ${s}5 000`,
      budgetMid: (s) => `${s}5 000 – ${s}15 000`,
      budgetHigh: (s) => `${s}15 000 і більше`,
      budgetUnsure: "Ще не знаю",
      notesLabel: "Що ще нам варто знати?",
      notesPlaceholder: "Фото, терміни, доступ, будь-що незвичне…",
      continueCta: "Далі",

      step3Title: "Куди надіслати відповідь?",
      step3Hint: "Достатньо електронної пошти або телефону.",
      namePlaceholder: "Ваше ім'я",
      emailPlaceholder: "Електронна пошта",
      phonePlaceholder: "Телефон",
      addressPlaceholder: "Де виконувати роботу?",
      errAddress: "Вкажіть, будь ласка, адресу об’єкта.",

      uploadLabel: "Додати фото, відео або PDF-план",
      uploadHint:
        "Фото, короткий ролик або ваш PDF-план допоможе нам оцінити точніше.",
      uploadDocumentFallback: "PDF-план",
      uploadBusy: "Завантаження…",
      uploadLimit: (n) => `Можна долучити до ${n} файлів.`,
      uploadFailed:
        "Не вдалося завантажити — перевірте з'єднання та спробуйте ще раз.",
      uploadRejected: "Цей файл не вдалося завантажити.",
      uploadTooLarge: (size, limit) => `Цей файл має розмір ${size} — максимум за одне завантаження — ${limit}. Зробіть фото меншого розміру або змініть його розмір і спробуйте ще раз.`,
      uploadRemove: "Прибрати",
      back: "Назад",
      sendCta: "Надіслати запит",
      noObligation: (company) =>
        `Без зобов'язань. ${company} повернеться до вас із ціною.`,

      errName: "Будь ласка, вкажіть своє ім'я.",
      errContact:
        "Додайте електронну пошту або номер телефону, щоб ми могли відповісти.",
      errSend: "Не вдалося надіслати ваш запит.",
      linkInvalid: "Це посилання недійсне.",
      linkInvalidHint:
        "Перевірте посилання або зверніться до компанії безпосередньо.",

      confirmTitle: "Запит отримано",
      confirmIntro: (company) =>
        `${company} має все наведене нижче і зв'яжеться з вами щодо ціни.`,
      requestedHeading: "Що ви запитали",
      nextHeading: "Що буде далі",
      next1Title: "Вони це прочитають",
      next1Body:
        "Ваші відповіді одразу надходять до компанії разом із усім, що ви долучили.",
      next2Title: "Вони визначать ціну",
      next2Body:
        "Людина розрахує реальну вартість вашої роботи — тут ніщо не оцінювалося автоматично.",
      next3Title: "Ви отримаєте кошторис",
      next3Body:
        "Він надійде як документ, який можна прочитати, обговорити та затвердити. До того нічого не узгоджено.",
      estimateLabel: "Орієнтовний діапазон",
      beforeTax: "без податків",
      gatedNote:
        "Ціна поки не показана — цей запит ще не оцінено. Це навмисно: сума, яку ви отримаєте, буде тією, за яку відповідає людина.",
      submittedLabel: "Надіслано",
      copySentTo: (email) => `Копія вже прямує на ${email}.`,
      callInstead: "Потрібно швидше?",
      // The in-person visit offered under the confirmation. Only rendered when
      // the company can actually take a booking — see lib/booking/canBookVisit.js.
      bookVisitTitle: "Хочете, щоб ми приїхали подивитися?",
      bookVisitBody: "Забронюйте візит, і ми підтвердимо вашу ціну на місці.",
      bookVisitCta: "Забронювати візит",

      emailSubject: (company) => `Ваш запит до ${company}`,
      emailIntro: (company) =>
        `Дякуємо — ${company} отримала ваш запит. Ось що ви надіслали, для ваших записів.`,
    },

    visit: {
      eyebrow: "Ваш візит",
      loadFailed: "Не вдалося завантажити ваш візит.",
      loadFailedHint:
        "Перевірте посилання з листа або зв'яжіться з компанією напряму.",

      aboutEstimate: (number) => `Щодо вашого кошторису ${number}`,

      whenLabel: "Коли",
      whereLabel: "Де",
      modeVisit: "Ми приїдемо до вас",
      modeCall: "Телефонний дзвінок — ми вам зателефонуємо",
      modeVideo: "Відеодзвінок — ми надішлемо посилання електронною поштою",
      addressUnknown: "Адресу буде підтверджено",
      depositPaid: (amount) => `Завдаток ${amount} сплачено`,

      changeHeading: "Потрібно щось змінити?",
      rescheduleCta: "Змінити час",
      cancelCta: "Скасувати цей візит",

      cannotCancelled: "Цей візит уже скасовано.",
      cannotHappened: "Цей візит уже відбувся.",
      cannotAwaitingPayment:
        "Цей візит ще не підтверджено — оплата не пройшла.",
      cannotNotFound: "Це посилання не відповідає жодному візиту.",
      cannotTooLate: (notice, company) =>
        `${company} просить попередити щонайменше за ${notice}, тому цей візит уже не можна змінити тут.`,
      cannotTooLateNoNotice: (company) =>
        `До вашого візиту залишилося замало часу, щоб ${company} прийняла зміну тут.`,
      // Three plural forms, which is the whole reason this is a function and
      // not "${n} годин" in a template. Accusative after «за».
      noticeHours: (n) => {
        const ten = n % 10;
        const hundred = n % 100;
        if (ten === 1 && hundred !== 11) return `${n} годину`;
        if (ten >= 2 && ten <= 4 && (hundred < 12 || hundred > 14))
          return `${n} години`;
        return `${n} годин`;
      },
      callInstead: (company, phone) =>
        phone
          ? `Зателефонуйте ${company} за номером ${phone} — вони ще можуть перенести візит.`
          : `Зв'яжіться з ${company} — вони ще можуть перенести візит.`,

      refundYes: (amount) =>
        `Ваш завдаток ${amount} буде повернено на картку, якою ви платили.`,
      refundNo: (amount) =>
        `Ваш завдаток ${amount} не повертається автоматично — зв'яжіться з ними щодо цього.`,
      refundAlready: (amount) => `Ваш завдаток ${amount} уже повернено.`,

      cancelConfirmTitle: "Скасувати цей візит?",
      cancelConfirmBody: (company) =>
        `${company} буде сповіщено одразу, а ваш час звільниться.`,
      yesCancel: "Так, скасувати",
      keepIt: "Залишити мій візит",
      cancelledTitle: "Візит скасовано",
      cancelledBody: (company) =>
        `${company} сповіщено. Якщо це помилка, зв'яжіться з ними — вони підберуть інший час.`,
      cancelledRefunded: (amount) =>
        `Ваш завдаток ${amount} уже в дорозі назад. Кошти можуть з'явитися у виписці за кілька днів.`,

      rescheduleTitle: "Оберіть новий час",
      rescheduleKeep: "Залишити поточний час",
      findingTimes: "Шукаємо вільний час…",
      timesFailed: "Наразі не вдалося завантажити вільний час.",
      pickADay: "Оберіть день, щоб побачити години.",
      morning: "Ранок",
      afternoon: "День",
      evening: "Вечір",
      nothingThisMonth: "Цього місяця вільного часу немає.",
      tryNextMonth: "Спробувати наступний місяць",
      prevMonth: "Попередній місяць",
      nextMonth: "Наступний місяць",
      confirmNewTime: "Перенести мій візит сюди",
      movedTitle: "Ваш візит перенесено",
      movedBody: (company) =>
        `${company} сповіщено, і нове підтвердження вже прямує до вас.`,

      questions: (company, phone) =>
        phone
          ? `Питання? Зателефонуйте ${company} за номером ${phone}.`
          : `Питання? Зв'яжіться з ${company}.`,

      slotTaken: "Цей час щойно зайняли. Оберіть інший.",
      tooSoon: "Цей час не дає їм достатньо попередження. Оберіть пізніший.",
      refundFailed:
        "Наразі не вдалося повернути ваш завдаток, тому нічого не скасовано. Спробуйте ще раз за хвилину або зв'яжіться з ними.",
    },
  },

  pa: {
    // "See the property" on /q/[token] — app/components/StreetViewPeek.js.
    streetView: { see: "ਜਾਇਦਾਦ ਵੇਖੋ", hide: "ਲੁਕਾਓ", openInMaps: "Google Maps ਵਿੱਚ ਖੋਲ੍ਹੋ", frameTitle: "ਜਾਇਦਾਦ ਦਾ Street View" },
    portalDocumentsHeading: "ਦਸਤਾਵੇਜ਼",

    proposal: {
      contents: "ਸਮੱਗਰੀ",
      yourProject: "ਤੁਹਾਡਾ ਪ੍ਰੋਜੈਕਟ",
      aboutUs: "ਸਾਡੇ ਬਾਰੇ",
      beforeAfter: "ਪਹਿਲਾਂ ਅਤੇ ਬਾਅਦ",
      importantDocuments: "ਜ਼ਰੂਰੀ ਦਸਤਾਵੇਜ਼",
      testimonials: "ਗਾਹਕਾਂ ਦੀ ਰਾਏ",
      services: "ਸੇਵਾਵਾਂ",
      scopeOfWork: "ਕੰਮ ਦਾ ਦਾਇਰਾ",
      priceByArea: "ਖੇਤਰ ਅਨੁਸਾਰ ਕੀਮਤ",
      quoteTotal: "ਕੋਟ ਦਾ ਕੁੱਲ",
      acceptQuote: "ਕੋਟ ਸਵੀਕਾਰ ਕਰੋ",
      day: (n) => `ਦਿਨ ${n}`,
      crewOf: (n) => `${n} ਦੀ ਟੀਮ`,
      halfDay: "ਅੱਧਾ ਦਿਨ",
      paintLine: (products, coats) =>
        products && coats ? `ਪੇਂਟ: ${products} · ${coats}` : products ? `ਪੇਂਟ: ${products}` : coats,
      coats: (n) => (n === 1 ? "1 ਕੋਟ" : `${n} ਕੋਟ`),
      viewDocument: "ਦਸਤਾਵੇਜ਼ ਵੇਖੋ →",
      before: "ਪਹਿਲਾਂ",
      after: "ਬਾਅਦ",
      recentWork: "ਹਾਲੀਆ ਕੰਮ",
      documentsHeading: "ਸਰਟੀਫਿਕੇਟ ਅਤੇ ਦਸਤਾਵੇਜ਼",
      whatClientsSaid: "ਗਾਹਕਾਂ ਨੇ ਕੀ ਕਿਹਾ",
      whatElseWeDo: "ਅਸੀਂ ਹੋਰ ਕੀ ਕਰਦੇ ਹਾਂ",
      watchVideo: "ਸਾਡੀ ਜਾਣ-ਪਛਾਣ ਵੀਡੀਓ ਵੇਖੋ",
      teamPhotoAlt: "ਸਾਡੀ ਟੀਮ",
    },
    // ── /estimate-report/[token] — the instant estimate as a proposal ─────
    // The same presentation as the quote, with the RANGE where the prices
    // would be (app/estimate-report/[token]/ReportView.js).
    rangeProposal: {
      yourEstimate: "ਤੁਹਾਡਾ ਅਨੁਮਾਨ",
      estimateWord: "ਅਨੁਮਾਨ",
      estimatedRange: "ਅਨੁਮਾਨਿਤ ਰੇਂਜ",
      subjectToVisit: "ਅਨੁਮਾਨ — ਸਾਈਟ ਦੌਰੇ ਦੇ ਅਧੀਨ",
      rangeFor: (option) => `ਇਸ ਲਈ: ${option}`,
      rangeNote: (company) => `ਤੁਹਾਡੇ ਦਿੱਤੇ ਵੇਰਵਿਆਂ ਦੇ ਆਧਾਰ 'ਤੇ। ${company} ਕੰਮ ਨੂੰ ਮੌਕੇ 'ਤੇ ਦੇਖਣ ਤੋਂ ਬਾਅਦ ਅੰਤਿਮ ਕੀਮਤ ਦੀ ਪੁਸ਼ਟੀ ਕਰਦਾ ਹੈ — ਜਦੋਂ ਤੱਕ ਤੁਸੀਂ ਕੋਟ ਮਨਜ਼ੂਰ ਨਹੀਂ ਕਰਦੇ, ਕੁਝ ਵੀ ਪੱਕਾ ਨਹੀਂ ਹੈ।`,
      noRange: (company) => `${company} ਸਾਈਟ ਦੌਰੇ ਤੋਂ ਬਾਅਦ ਤੁਹਾਡੀ ਕੀਮਤ ਦੀ ਪੁਸ਼ਟੀ ਕਰੇਗਾ।`,
      whatHappensNext: "ਅੱਗੇ ਕੀ ਹੁੰਦਾ ਹੈ",
      bookVisit: "ਆਪਣਾ ਸਾਈਟ ਦੌਰਾ ਬੁੱਕ ਕਰੋ",
      talkToUs: "ਸਾਡੇ ਨਾਲ ਗੱਲ ਕਰੋ",
    },
    waiverKicker: "ਛੋਟ-ਪੱਤਰ",
    waiverAttachedTo: (ref) => `${ref} ਨਾਲ ਜੁੜਿਆ`,
    waiverIntro: "ਕਿਰਪਾ ਕਰਕੇ ਹਰ ਭਾਗ ਪੜ੍ਹੋ ਅਤੇ ਟਿੱਕ ਕਰੋ ਕਿ ਤੁਸੀਂ ਇਸਨੂੰ ਸਮਝ ਲਿਆ ਹੈ। ਦਸਤਖ਼ਤ ਅੰਤ ਵਿੱਚ ਹਨ।",
    waiverAcknowledgements: "ਸਵੀਕ੍ਰਿਤੀਆਂ",
    waiverSign: "ਦਸਤਖ਼ਤ ਕਰੋ",
    waiverAcknowledged: (n, total) => `${total} ਵਿੱਚੋਂ ${n} ਸਵੀਕਾਰ ਕੀਤੇ`,
    signWaiver: "ਛੋਟ-ਪੱਤਰ 'ਤੇ ਦਸਤਖ਼ਤ ਕਰੋ",
    waiverTickRemaining: (n) =>
      n === 1 ? "ਦਸਤਖ਼ਤ ਕਰਨ ਲਈ ਬਾਕੀ ਸਵੀਕ੍ਰਿਤੀ 'ਤੇ ਟਿੱਕ ਕਰੋ।" : `ਦਸਤਖ਼ਤ ਕਰਨ ਲਈ ਬਾਕੀ ${n} ਸਵੀਕ੍ਰਿਤੀਆਂ 'ਤੇ ਟਿੱਕ ਕਰੋ।`,
    waiverConsent: "ਮੈਂ ਸਹਿਮਤ ਹਾਂ ਕਿ ਇੱਥੇ ਦਸਤਖ਼ਤ ਕਰਨਾ ਮੇਰਾ ਇਲੈਕਟ੍ਰਾਨਿਕ ਦਸਤਖ਼ਤ ਹੈ ਅਤੇ ਮੈਂ ਇਹ ਛੋਟ-ਪੱਤਰ ਪੜ੍ਹ ਕੇ ਸਵੀਕਾਰ ਕੀਤਾ ਹੈ।",
    waiverSignedTitle: "ਛੋਟ-ਪੱਤਰ 'ਤੇ ਦਸਤਖ਼ਤ ਹੋ ਗਏ — ਧੰਨਵਾਦ",
    waiverSignedBody: (company) => `ਇੱਕ ਕਾਪੀ ਤੁਹਾਨੂੰ ਭੇਜ ਦਿੱਤੀ ਗਈ ਹੈ ਅਤੇ ${company} ਕੋਲ ਦਰਜ ਕਰ ਲਈ ਗਈ ਹੈ।`,
    waiverSignedOn: (date) => `ਦਸਤਖ਼ਤ ${date}`,
    waiverSignedBy: (name, date) => `${name} ਵੱਲੋਂ ${date} ਨੂੰ ਦਸਤਖ਼ਤ`,
    waiverAfterNote: "ਦਸਤਖ਼ਤ ਹੋਣ 'ਤੇ ਤਾਰੀਖ਼, ਤੁਹਾਡੇ ਨਾਮ ਅਤੇ ਹਰ ਸਵੀਕ੍ਰਿਤੀ ਵਾਲੀ ਕਾਪੀ ਤੁਹਾਨੂੰ ਭੇਜੀ ਜਾਂਦੀ ਹੈ ਅਤੇ ਇਸ ਕੰਮ ਵਿੱਚ ਦਰਜ ਹੁੰਦੀ ਹੈ। ਕੋਟ 'ਤੇ ਵੱਖਰੇ ਦਸਤਖ਼ਤ ਹੁੰਦੇ ਹਨ।",
    waiverRequiredBeforeApprove: "ਇਸ ਕੋਟ ਨੂੰ ਮਨਜ਼ੂਰ ਕਰਨ ਤੋਂ ਪਹਿਲਾਂ ਜੁੜੇ ਛੋਟ-ਪੱਤਰ 'ਤੇ ਦਸਤਖ਼ਤ ਕਰੋ।",
    waiverCopyIntro: (company) => `${company} ਲਈ ਛੋਟ-ਪੱਤਰ ਦੀ ਤੁਹਾਡੀ ਦਸਤਖ਼ਤ ਕੀਤੀ ਕਾਪੀ ਨੱਥੀ ਹੈ।`,
    waiverLinkIntro: (company, title) => `${company} ਕੋਲ ਤੁਹਾਡੇ ਪੜ੍ਹਨ ਅਤੇ ਦਸਤਖ਼ਤ ਕਰਨ ਲਈ ਇੱਕ ਦਸਤਾਵੇਜ਼ ਹੈ: "${title}"। ਇਸ ਵਿੱਚ ਇੱਕ ਮਿੰਟ ਲੱਗਦਾ ਹੈ।`,
    waiverOpen: "ਪੜ੍ਹੋ ਅਤੇ ਦਸਤਖ਼ਤ ਕਰੋ",
    approveThisQuote: "ਇਹ ਹਵਾਲਾ ਮਨਜ਼ੂਰ ਕਰੋ",
    decline: "ਇਨਕਾਰ ਕਰੋ",
    whatsIncluded: "ਕੀ ਸ਼ਾਮਲ ਹੈ",
    whatCouldChange: "ਇਸ ਕੀਮਤ ਨੂੰ ਕੀ ਬਦਲ ਸਕਦਾ ਹੈ",
    termsExplained: "ਇਸ ਹਵਾਲੇ ਦੀਆਂ ਸ਼ਰਤਾਂ, ਸਮਝਾਈਆਂ ਗਈਆਂ",
    optionalExtras: "ਵਿਕਲਪਿਕ ਵਾਧੂ",
    extrasTickHint:
      "ਜੋ ਵੀ ਤੁਸੀਂ ਜੋੜਨਾ ਚਾਹੁੰਦੇ ਹੋ, ਉਸ 'ਤੇ ਨਿਸ਼ਾਨ ਲਗਾਓ। ਕੁੱਲ ਨਾਲੋ-ਨਾਲ ਬਦਲਦਾ ਹੈ — ਤੁਹਾਡੀ ਮਨਜ਼ੂਰੀ ਤੋਂ ਬਿਨਾਂ ਕੁਝ ਵੀ ਨਹੀਂ ਲਿਆ ਜਾਂਦਾ।",
    extrasChosen: "ਇਸ ਹਵਾਲੇ ਦੀ ਮਨਜ਼ੂਰੀ ਵੇਲੇ ਚੁਣਿਆ ਗਿਆ।",
    includesOptionalExtras: "ਵਿਕਲਪਿਕ ਵਾਧੂ ਸ਼ਾਮਲ ਹਨ",
    payOfflineHint: "ਤੁਸੀਂ ਕਾਰਡ ਦੀ ਬਜਾਏ ਈ-ਟ੍ਰਾਂਸਫਰ ਜਾਂ ਚੈੱਕ ਨਾਲ ਭੁਗਤਾਨ ਕਰੋਗੇ।",
    howTheWorkRuns: "ਕੰਮ ਕਿਵੇਂ ਚੱਲਦਾ ਹੈ",
    paymentTerms: "ਭੁਗਤਾਨ ਦੀਆਂ ਸ਼ਰਤਾਂ",
    yourFullName: "ਤੁਹਾਡਾ ਪੂਰਾ ਨਾਮ",
    typeYourName: "ਆਪਣਾ ਨਾਮ ਲਿਖੋ",
    signature: "ਦਸਤਖ਼ਤ",
    signatureConsent: (total) =>
      `ਮੈਂ ਸਹਿਮਤ ਹਾਂ ਕਿ ਇੱਥੇ ਦਸਤਖ਼ਤ ਕਰਨਾ ਮੇਰਾ ਇਲੈਕਟ੍ਰਾਨਿਕ ਦਸਤਖ਼ਤ ਹੈ ਅਤੇ ਇਹ ਹਵਾਲਾ ${total} ਲਈ ਮਨਜ਼ੂਰ ਕਰਦਾ ਹੈ।`,
    approveConfirm: (total) => `ਇਹ ਹਵਾਲਾ ${total} ਲਈ ਮਨਜ਼ੂਰ ਕਰਨਾ ਹੈ?`,
    declineConfirm: "ਇਹ ਹਵਾਲਾ ਇਨਕਾਰ ਕਰਨਾ ਹੈ?",
    approveSubExtras: (extras) =>
      `${extras} ਦੇ ਵਿਕਲਪਿਕ ਵਾਧੂ ਸਮੇਤ। ਇਹ ਉਨ੍ਹਾਂ ਨੂੰ ਅੱਗੇ ਵਧਣ ਲਈ ਕਹਿੰਦਾ ਹੈ।`,
    approveSubPlain: "ਇਹ ਉਨ੍ਹਾਂ ਨੂੰ ਅੱਗੇ ਵਧਣ ਲਈ ਕਹਿੰਦਾ ਹੈ।",
    declineSub: "ਤੁਸੀਂ ਹਮੇਸ਼ਾ ਸੋਧਿਆ ਹਵਾਲਾ ਮੰਗ ਸਕਦੇ ਹੋ।",
    yesApprove: "ਹਾਂ, ਮਨਜ਼ੂਰ ਕਰੋ",
    yesDecline: "ਹਾਂ, ਇਨਕਾਰ ਕਰੋ",
    goBack: "ਵਾਪਸ ਜਾਓ",
    approvedTitle: "ਮਨਜ਼ੂਰ — ਧੰਨਵਾਦ",
    approvedBody: (company) =>
      `${company} ਨੂੰ ਸੂਚਿਤ ਕਰ ਦਿੱਤਾ ਗਿਆ ਹੈ ਅਤੇ ਉਹ ਅਗਲੇ ਕਦਮਾਂ ਬਾਰੇ ਸੰਪਰਕ ਕਰਨਗੇ।`,
    declinedTitle: "ਹਵਾਲਾ ਇਨਕਾਰ ਕੀਤਾ",
    declinedBody: (company) =>
      `${company} ਨੂੰ ਸੂਚਿਤ ਕਰ ਦਿੱਤਾ ਗਿਆ ਹੈ। ਜੇ ਇਹ ਗਲਤੀ ਸੀ, ਤਾਂ ਉਨ੍ਹਾਂ ਨੂੰ ਫ਼ੋਨ ਕਰੋ।`,
    expiredTitle: "ਇਸ ਹਵਾਲੇ ਦੀ ਮਿਆਦ ਲੰਘ ਗਈ ਹੈ",
    expiredBody: (company) => `ਅੱਪਡੇਟ ਕੀਤੀ ਕੀਮਤ ਲਈ ${company} ਨਾਲ ਸੰਪਰਕ ਕਰੋ।`,
    approvedCopyIntro: (company) =>
      `${company} ਨਾਲ ਆਪਣਾ ਹਵਾਲਾ ਮਨਜ਼ੂਰ ਕਰਨ ਲਈ ਧੰਨਵਾਦ। ਤੁਹਾਡੇ ਰਿਕਾਰਡ ਲਈ ਇੱਕ ਕਾਪੀ ਨੱਥੀ ਹੈ।`,
    measuredAt: (address) => `ਮਾਪਿਆ ਗਿਆ: ${address}`,
    genericError: "ਕੁਝ ਗਲਤ ਹੋ ਗਿਆ। ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।",
    connectionLost: "ਅਸੀਂ ਤੁਹਾਡਾ ਹਵਾਲਾ ਲੋਡ ਨਹੀਂ ਕਰ ਸਕੇ।",
    connectionLostHint:
      "ਸ਼ਾਇਦ ਸਿਗਨਲ ਚਲਾ ਗਿਆ ਹੈ। ਆਪਣਾ ਕੁਨੈਕਸ਼ਨ ਜਾਂਚੋ ਅਤੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ — ਕੁਝ ਵੀ ਭੇਜਿਆ ਨਹੀਂ ਗਿਆ।",
    tryAgain: "ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ",
    linkInvalidHint:
      "ਜਿਸ ਕੰਪਨੀ ਨੇ ਇਹ ਭੇਜਿਆ ਸੀ ਉਸ ਨਾਲ ਸੰਪਰਕ ਕਰੋ, ਉਹ ਨਵਾਂ ਲਿੰਕ ਭੇਜ ਸਕਦੇ ਹਨ।",

    financingAvailable: "ਵਿੱਤ ਸਹੂਲਤ",
    financingHeading: "ਮਹੀਨਾਵਾਰ ਭੁਗਤਾਨ",
    financingMonthly: (monthly) => `ਲਗਭਗ ${monthly} ਪ੍ਰਤੀ ਮਹੀਨਾ`,
    financingTermsLine: (months, apr) =>
      `${months} ਮਹੀਨਿਆਂ ਲਈ, ${apr} ਸਾਲਾਨਾ ਵਿਆਜ ਦਰ ਦੇ ਆਧਾਰ 'ਤੇ ਅੰਦਾਜ਼ਾ।`,
    financingEstimateNote: (company) =>
      `ਇਹ ਸਿਰਫ਼ ਇੱਕ ਅੰਦਾਜ਼ਾ ਹੈ, ${company} ਵੱਲੋਂ ਦੱਸੀਆਂ ਸ਼ਰਤਾਂ ਅਤੇ ਉੱਪਰਲੇ ਕੁੱਲ ਦੇ ਆਧਾਰ 'ਤੇ। ਅਸਲ ਵਿਆਜ ਦਰ, ਕਿਸ਼ਤ ਅਤੇ ਮਨਜ਼ੂਰੀ ਦੀ ਪੁਸ਼ਟੀ ਤੁਹਾਡੀ ਵਿੱਤ ਕੰਪਨੀ ਅਰਜ਼ੀ ਵੇਲੇ ਕਰਦੀ ਹੈ।`,
    financingCta: "ਵਿੱਤ ਵਿਕਲਪ ਵੇਖੋ",
    quoteQuestions: (company, phone) =>
      phone
        ? `ਸਵਾਲ? ਈਮੇਲ ਦਾ ਜਵਾਬ ਦਿਓ, ਜਾਂ ${company} ਨੂੰ ${phone} 'ਤੇ ਫ਼ੋਨ ਕਰੋ।`
        : `ਸਵਾਲ? ਈਮੇਲ ਦਾ ਜਵਾਬ ਦਿਓ, ਜਾਂ ${company} ਨੂੰ ਫ਼ੋਨ ਕਰੋ।`,

    accountFor: (name) => `${name} ਲਈ ਖਾਤਾ`,
    balanceOwing: "ਬਕਾਇਆ ਰਕਮ",
    nothingOutstanding: "ਕੁਝ ਵੀ ਬਕਾਇਆ ਨਹੀਂ। ਧੰਨਵਾਦ।",
    acrossInvoices: (n) => `${n} ਬਿੱਲਾਂ ਵਿੱਚ।`,
    invoicesHeading: "ਬਿੱਲ",
    quotesHeading: "ਹਵਾਲੇ",
    paidNote: (amount) => `${amount} ਅਦਾ ਕੀਤਾ`,
    dueNote: (date) => `${date} ਤੱਕ`,
    pay: (amount) => `${amount} ਭੁਗਤਾਨ ਕਰੋ`,
    paid: "ਅਦਾ ਕੀਤਾ",
    review: "ਵੇਖੋ",
    // Keyed by the QuoteStatus enum — see the note in the `en` block.
    quoteStatus: {
      draft: "ਡਰਾਫਟ",
      sent: "ਤੁਹਾਡੇ ਜਵਾਬ ਦੀ ਉਡੀਕ",
      accepted: "ਮਨਜ਼ੂਰ",
      declined: "ਇਨਕਾਰ ਕੀਤਾ",
    },
    paymentReceived:
      "ਭੁਗਤਾਨ ਮਿਲ ਗਿਆ — ਧੰਨਵਾਦ। ਹੇਠਾਂ ਦਿਖਣ ਵਿੱਚ ਇੱਕ ਮਿੰਟ ਲੱਗ ਸਕਦਾ ਹੈ।",
    payCard: (amount) => `${amount} ਕਾਰਡ ਨਾਲ ਭਰੋ`,
    payBank: (amount) => `${amount} ਬੈਂਕ ਖਾਤੇ ਤੋਂ ਭਰੋ`,
    bankNote: "ਬੈਂਕ ਭੁਗਤਾਨ ਨੂੰ ਕਲੀਅਰ ਹੋਣ ਵਿੱਚ 3–5 ਕਾਰੋਬਾਰੀ ਦਿਨ ਲੱਗਦੇ ਹਨ। ਉਦੋਂ ਤੱਕ ਇਨਵੌਇਸ ਲੰਬਿਤ ਦਿਖਦਾ ਹੈ।",
    bankPendingBanner: "ਬੈਂਕ ਭੁਗਤਾਨ ਮਿਲ ਗਿਆ — ਇਸਨੂੰ ਕਲੀਅਰ ਹੋਣ ਵਿੱਚ 3–5 ਕਾਰੋਬਾਰੀ ਦਿਨ ਲੱਗਦੇ ਹਨ। ਉਸ ਤੋਂ ਬਾਅਦ ਇਨਵੌਇਸ ਭਰਿਆ ਹੋਇਆ ਦਿਖੇਗਾ।",
    bankPending: "ਬੈਂਕ ਭੁਗਤਾਨ ਲੰਬਿਤ",
    bankFailed: (reason) => `ਬੈਂਕ ਭੁਗਤਾਨ ਅਸਫਲ ਰਿਹਾ${reason ? ` — ${reason}` : ""}। ਤੁਸੀਂ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰ ਸਕਦੇ ਹੋ ਜਾਂ ਕਾਰਡ ਨਾਲ ਭਰ ਸਕਦੇ ਹੋ।`,
    bankOverCap: (max, amount) => `ਬੈਂਕ ਡੈਬਿਟ ਇੱਕ ਭੁਗਤਾਨ ਵਿੱਚ ${max} ਤੱਕ ਉਪਲਬਧ ਹੈ — ਇਹ ਇਨਵੌਇਸ ${amount} ਦਾ ਹੈ, ਇਸ ਲਈ ਸਿਰਫ਼ ਕਾਰਡ ਨਾਲ।`,
    paymentNotStarted: (company) => `ਇਹ ਭੁਗਤਾਨ ਸ਼ੁਰੂ ਨਹੀਂ ਹੋ ਸਕਿਆ — ਕਿਰਪਾ ਕਰਕੇ ਕਾਰਡ ਨਾਲ ਕੋਸ਼ਿਸ਼ ਕਰੋ ਜਾਂ ${company} ਨਾਲ ਸੰਪਰਕ ਕਰੋ।`,
    portalQuestions: (company, phone, email) =>
      `ਇਸ ਬਾਰੇ ਸਵਾਲ? ${company}${phone ? ` ਨੂੰ ${phone} 'ਤੇ` : ""}${email ? ` · ${email}` : ""} ਸੰਪਰਕ ਕਰੋ।`,

    backToAccount: "ਆਪਣੇ ਖਾਤੇ 'ਤੇ ਵਾਪਸ",
    due: "ਭੁਗਤਾਨ",
    wasDue: "ਭੁਗਤਾਨ ਸੀ",
    noItemisedBreakdown: "ਇਸ ਬਿੱਲ 'ਤੇ ਕੋਈ ਵੇਰਵਾ ਨਹੀਂ।",
    paidInFull: "ਪੂਰਾ ਅਦਾ ਕੀਤਾ",
    paidInFullThanks: "ਪੂਰਾ ਅਦਾ ਕੀਤਾ — ਧੰਨਵਾਦ",
    invoiceNotFound: "ਉਹ ਬਿੱਲ ਤੁਹਾਡੇ ਖਾਤੇ ਵਿੱਚ ਨਹੀਂ ਹੈ।",
    arrangePayment: "ਭੁਗਤਾਨ ਦਾ ਪ੍ਰਬੰਧ ਕਰਨ ਲਈ ਕਿਰਪਾ ਕਰਕੇ ਸਾਡੇ ਨਾਲ ਸੰਪਰਕ ਕਰੋ।",
    acceptedMethods: (methods) => `ਸਵੀਕਾਰ: ${methods}।`,

    portal: {
      nextVisitKicker: "ਅਗਲੀ ਫੇਰੀ",
      planKicker: "ਤੁਹਾਡਾ ਪਲਾਨ",
      upcomingHeading: "ਆਉਣ ਵਾਲੀਆਂ ਫੇਰੀਆਂ",
      pastHeading: "ਪਿਛਲੀਆਂ ਫੇਰੀਆਂ",
      between: (from, to) => `${from} ਅਤੇ ${to} ਦੇ ਵਿਚਕਾਰ`,
      at: (time) => `${time} ਵਜੇ`,
      withCrew: (name) => `${name} ਨਾਲ`,
      typeVisit: "ਫੇਰੀ",
      typeReturn: "ਵਾਪਸੀ ਫੇਰੀ",
      typeAppointment: "ਮੁਲਾਕਾਤ",
      typeCall: "ਫ਼ੋਨ ਕਾਲ",
      typeVideo: "ਵੀਡੀਓ ਕਾਲ",
      frequency: {
        weekly: "ਹਰ ਹਫ਼ਤੇ",
        monthly: "ਹਰ ਮਹੀਨੇ",
        quarterly: "ਹਰ 3 ਮਹੀਨੇ",
        semiannual: "ਸਾਲ ਵਿੱਚ ਦੋ ਵਾਰ",
        annual: "ਸਾਲ ਵਿੱਚ ਇੱਕ ਵਾਰ",
      },
      perVisit: (amount) => `${amount} ਪ੍ਰਤੀ ਫੇਰੀ`,
      taxIncluded: "ਟੈਕਸ ਸਮੇਤ",
      memberDiscount: (pct) => `ਤੁਹਾਡੀ ${pct}% ਪਲਾਨ ਛੋਟ ਸ਼ਾਮਲ ਹੈ`,
      included: "ਕੀ ਸ਼ਾਮਲ ਹੈ",
      nextDates: "ਅਗਲੀਆਂ ਤਾਰੀਖਾਂ",
      endsOn: (date) => `ਪਲਾਨ ${date} ਤੱਕ ਚੱਲਦਾ ਹੈ`,
      visitsSold: (n) => `ਇਸ ਪਲਾਨ ਵਿੱਚ ${n} ਫੇਰੀਆਂ`,
      reschedule: "ਸਮਾਂ ਬਦਲਣ ਦੀ ਬੇਨਤੀ ਕਰੋ",
      skip: "ਇਹ ਫੇਰੀ ਛੱਡੋ",
      rescheduleQuestion: "ਤੁਹਾਡੇ ਲਈ ਕਿਹੜਾ ਸਮਾਂ ਬਿਹਤਰ ਹੈ?",
      skipQuestion: "ਕੁਝ ਅਜਿਹਾ ਜੋ ਸਾਨੂੰ ਪਤਾ ਹੋਣਾ ਚਾਹੀਦਾ ਹੈ? (ਵਿਕਲਪਿਕ)",
      requestPlaceholder: "ਉਦਾਹਰਨ ਲਈ: 20 ਤਾਰੀਖ ਤੋਂ ਬਾਅਦ ਕੋਈ ਵੀ ਹਫ਼ਤੇ ਦਾ ਦਿਨ",
      requestExplain: (company) => `${company} ਤੁਹਾਡੇ ਨਾਲ ਸੰਪਰਕ ਕਰੇਗਾ। ਉਨ੍ਹਾਂ ਦੀ ਪੁਸ਼ਟੀ ਤੱਕ ਕੁਝ ਨਹੀਂ ਬਦਲਦਾ।`,
      requestSend: "ਬੇਨਤੀ ਭੇਜੋ",
      cancel: "ਰੱਦ ਕਰੋ",
      requested: "ਬੇਨਤੀ ਭੇਜੀ ਗਈ",
      requestTooLate: "ਇਹ ਫੇਰੀ ਇੱਥੇ ਬਦਲਣ ਲਈ ਬਹੁਤ ਨੇੜੇ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਫ਼ੋਨ ਕਰੋ।",
      requestFailed: "ਤੁਹਾਡੀ ਬੇਨਤੀ ਨਹੀਂ ਭੇਜੀ ਜਾ ਸਕੀ। ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ ਜਾਂ ਫ਼ੋਨ ਕਰੋ।",
      callToChange: "ਇੱਕ ਦਿਨ ਤੋਂ ਘੱਟ ਬਾਕੀ। ਬਦਲਣ ਲਈ ਫ਼ੋਨ ਕਰੋ।",
      photoAlt: "ਇਸ ਫੇਰੀ ਦੀ ਫ਼ੋਟੋ",
      loginEmailSubject: (company) => `${company} ਨਾਲ ਤੁਹਾਡਾ ਖਾਤਾ`,
      loginEmailLabel: "ਤੁਹਾਡਾ ਖਾਤਾ",
      loginEmailGreeting: (first) => (first ? `ਸਤ ਸ੍ਰੀ ਅਕਾਲ ${first},` : "ਸਤ ਸ੍ਰੀ ਅਕਾਲ,"),
      loginEmailIntro: (company) => `ਇਹ ${company} ਨਾਲ ਤੁਹਾਡੇ ਖਾਤੇ ਦਾ ਲਿੰਕ ਹੈ: ਤੁਹਾਡੇ ਹਵਾਲੇ, ਇਨਵੌਇਸ, ਫੇਰੀਆਂ ਅਤੇ ਪਲਾਨ ਇੱਕ ਥਾਂ।`,
      loginEmailButton: "ਆਪਣਾ ਖਾਤਾ ਖੋਲ੍ਹੋ",
      loginEmailKeep: "ਇਹ ਲਿੰਕ ਸਿਰਫ਼ ਤੁਹਾਡੇ ਲਈ ਹੈ। ਇਸਨੂੰ ਕਿਸੇ ਨਾਲ ਸਾਂਝਾ ਨਾ ਕਰੋ, ਅਤੇ ਕਦੇ ਵੀ ਵਾਪਸ ਆਉਣ ਲਈ ਬੁੱਕਮਾਰਕ ਕਰ ਲਓ।",
      loginEmailIgnore: "ਜੇ ਤੁਸੀਂ ਇਹ ਲਿੰਕ ਨਹੀਂ ਮੰਗਿਆ, ਤਾਂ ਇਸ ਈਮੇਲ ਨੂੰ ਨਜ਼ਰਅੰਦਾਜ਼ ਕਰ ਸਕਦੇ ਹੋ। ਤੁਹਾਡੇ ਖਾਤੇ ਵਿੱਚ ਕੁਝ ਨਹੀਂ ਬਦਲਿਆ।",
      rescheduleSubject: (what, date) => `${date} ਵਾਲੀ ${what} ਬਦਲੋ`,
      skipSubject: (what, date) => `${date} ਵਾਲੀ ${what} ਛੱਡੋ`,
      requestNoMessage: "ਕੋਈ ਸੁਨੇਹਾ ਨਹੀਂ — ਕਿਰਪਾ ਕਰਕੇ ਕੋਈ ਹੋਰ ਤਾਰੀਖ ਸੁਝਾਓ।",
      maintenanceSubject: (plan) => `ਮੇਰੀ ਅਗਲੀ ਫੇਰੀ ਬੁੱਕ ਕਰੋ — ${plan}`,
      preferredLine: (when) => `ਮੇਰੇ ਲਈ ਠੀਕ ਸਮਾਂ: ${when}`,
      maintenanceNoNote: "ਕਿਰਪਾ ਕਰਕੇ ਮੇਰੀ ਅਗਲੀ ਸ਼ਾਮਲ ਫੇਰੀ ਲਈ ਤਾਰੀਖ ਸੁਝਾਓ।",
      ticketReplySubject: (subject) => `Re: ${subject}`,
      ticketReplyIntro: (who, subject) => `${who} ਨੇ “${subject}” ਬਾਰੇ ਜਵਾਬ ਦਿੱਤਾ:`,
      ticketReplyButton: "ਦੇਖੋ ਅਤੇ ਜਵਾਬ ਦਿਓ",
      ticketEmailLabel: "ਤੁਹਾਡੀ ਬੇਨਤੀ",
      tickets: {
        heading: "ਤੁਹਾਡੀਆਂ ਬੇਨਤੀਆਂ",
        reportIssue: "ਸਮੱਸਿਆ ਦੱਸੋ",
        requestWork: "ਕੰਮ ਦੀ ਬੇਨਤੀ ਕਰੋ",
        reportOnVisit: "ਸਮੱਸਿਆ ਦੱਸੋ",
        reportTitle: "ਸਮੱਸਿਆ ਦੱਸੋ",
        aboutVisit: (date) => `${date} ਦੀ ਫੇਰੀ ਬਾਰੇ`,
        typeLabel: "ਇਹ ਕਿਸ ਬਾਰੇ ਹੈ?",
        types: {
          repair: "ਕੁਝ ਠੀਕ ਕਰਨ ਵਾਲਾ ਹੈ",
          warranty: "ਵਾਰੰਟੀ ਦਾਅਵਾ",
          question: "ਇੱਕ ਸਵਾਲ",
          billing: "ਬਿਲਿੰਗ",
          reschedule: "ਤਾਰੀਖ ਬਦਲੋ",
          maintenance: "ਮੇਨਟੇਨੈਂਸ ਫੇਰੀ",
        },
        subjectLabel: "ਛੋਟਾ ਸਾਰ",
        bodyLabel: "ਸਾਨੂੰ ਦੱਸੋ ਕੀ ਹੋ ਰਿਹਾ ਹੈ",
        photosLabel: "ਫ਼ੋਟੋਆਂ (ਵਿਕਲਪਿਕ)",
        addPhoto: "ਫ਼ੋਟੋ ਜੋੜੋ",
        uploading: "ਅੱਪਲੋਡ ਹੋ ਰਿਹਾ ਹੈ…",
        uploadFailed: "ਉਹ ਫ਼ੋਟੋ ਅੱਪਲੋਡ ਨਹੀਂ ਹੋ ਸਕੀ।",
        send: "ਭੇਜੋ",
        cancel: "ਰੱਦ ਕਰੋ",
        sent: (company) => `ਭੇਜ ਦਿੱਤਾ। ${company} ਇੱਥੇ ਅਤੇ ਈਮੇਲ ਰਾਹੀਂ ਜਵਾਬ ਦੇਵੇਗਾ।`,
        failed: "ਭੇਜਿਆ ਨਹੀਂ ਜਾ ਸਕਿਆ। ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।",
        status: {
          open: "ਮਿਲ ਗਈ",
          in_progress: "ਜਾਰੀ ਹੈ",
          waiting_on_client: "ਤੁਹਾਡੀ ਉਡੀਕ ਹੈ",
          resolved: "ਹੱਲ ਹੋ ਗਈ",
          closed: "ਬੰਦ",
        },
        you: "ਤੁਸੀਂ",
        replyPlaceholder: "ਜਵਾਬ ਲਿਖੋ…",
        sendReply: "ਜਵਾਬ ਭੇਜੋ",
        closedNote: "ਇਹ ਬੇਨਤੀ ਬੰਦ ਹੈ। ਜੇ ਕੁਝ ਹੋਰ ਹੋਵੇ ਤਾਂ ਨਵੀਂ ਸਮੱਸਿਆ ਦੱਸੋ।",
        workTitle: "ਕੰਮ ਦੀ ਬੇਨਤੀ ਕਰੋ",
        workNewJob: "ਨਵਾਂ ਕੰਮ ਜਾਂ ਹਵਾਲਾ",
        workMaintenance: "ਮੇਨਟੇਨੈਂਸ ਫੇਰੀ",
        workService: "ਕਿਹੜੀ ਸੇਵਾ?",
        workServiceOther: "ਕੁਝ ਹੋਰ",
        workDescribe: "ਕੰਮ ਦਾ ਵੇਰਵਾ ਦਿਓ",
        workDates: "ਪਸੰਦੀਦਾ ਤਾਰੀਖਾਂ (ਵਿਕਲਪਿਕ)",
        workDatesPlaceholder: "ਉਦਾਹਰਨ ਲਈ: ਨਵੰਬਰ ਦੇ ਸ਼ੁਰੂ ਵਿੱਚ ਕੋਈ ਵੀ ਹਫ਼ਤੇ ਦਾ ਦਿਨ",
        workSent: (company) => `ਭੇਜ ਦਿੱਤਾ। ${company} ਪੁਸ਼ਟੀ ਲਈ ਤੁਹਾਡੇ ਨਾਲ ਸੰਪਰਕ ਕਰੇਗਾ। ਉਦੋਂ ਤੱਕ ਕੁਝ ਵੀ ਬੁੱਕ ਜਾਂ ਚਾਰਜ ਨਹੀਂ ਹੁੰਦਾ।`,
        workPlan: "ਕਿਹੜਾ ਪਲਾਨ?",
        workRemaining: (n) => `ਬਾਕੀ ਸ਼ਾਮਲ ਫੇਰੀਆਂ: ${n}`,
        workUntilCancelled: "ਫੇਰੀਆਂ ਪਲਾਨ ਖ਼ਤਮ ਹੋਣ ਤੱਕ ਜਾਰੀ ਰਹਿੰਦੀਆਂ ਹਨ",
        workWindow: "ਤੁਹਾਡੇ ਲਈ ਕਦੋਂ ਠੀਕ ਹੈ?",
        workWindowPlaceholder: "ਉਦਾਹਰਨ ਲਈ: ਸਵੇਰੇ, 10 ਤਾਰੀਖ ਵਾਲਾ ਹਫ਼ਤਾ",
        workNote: "ਕੁਝ ਹੋਰ? (ਵਿਕਲਪਿਕ)",
        workSetupIntro: (company) => `ਤੁਹਾਡੇ ਕੋਲ ਅਜੇ ਕੋਈ ਮੇਨਟੇਨੈਂਸ ਪਲਾਨ ਨਹੀਂ ਹੈ। ${company} ਨੂੰ ਦੱਸੋ ਕਿ ਤੁਸੀਂ ਕਿਸ ਚੀਜ਼ ਦੀ ਨਿਯਮਤ ਦੇਖਭਾਲ ਚਾਹੁੰਦੇ ਹੋ ਅਤੇ ਕਿੰਨੀ ਵਾਰ, ਉਹ ਵਿਕਲਪਾਂ ਨਾਲ ਜਵਾਬ ਦੇਣਗੇ।`,
        workSetupDescribe: "ਕਿਸ ਚੀਜ਼ ਦੀ ਦੇਖਭਾਲ ਕਰਨੀ ਹੈ, ਅਤੇ ਕਿੰਨੀ ਵਾਰ?",
        workConfirmNote: (company) => `${company} ਬੁੱਕ ਕਰਨ ਤੋਂ ਪਹਿਲਾਂ ਸਭ ਕੁਝ ਪੱਕਾ ਕਰਦਾ ਹੈ। ਇੱਥੋਂ ਕੁਝ ਵੀ ਤੈਅ ਜਾਂ ਚਾਰਜ ਨਹੀਂ ਹੁੰਦਾ।`,
      },
    },

    job: {
      kicker: "ਤੁਹਾਡਾ ਕੰਮ",
      dayOf: (day, total) => `ਦਿਨ ${day} / ${total}`,
      onSchedule: "ਸਮੇਂ ਸਿਰ",
      runningLate: "ਦੇਰੀ ਨਾਲ",
      finished: "ਪੂਰਾ ਹੋਇਆ",
      started: (date) => `${date} ਨੂੰ ਸ਼ੁਰੂ ਹੋਇਆ`,
      finishPlanned: (date) => `${date} ਨੂੰ ਪੂਰਾ ਹੋਣ ਦੀ ਯੋਜਨਾ`,
      datesToConfirm: "ਤਾਰੀਖਾਂ ਦੀ ਪੁਸ਼ਟੀ ਬਾਕੀ",
      done: "ਹੋ ਗਿਆ",
      inProgress: "ਚੱਲ ਰਿਹਾ",
      waitingOn: "ਇੰਤਜ਼ਾਰ ਵਿੱਚ",
      upNext: "ਅੱਗੇ",
      photos: (n) => (n === 1 ? "1 ਫੋਟੋ" : `${n} ਫੋਟੋਆਂ`),
      onSiteSince: (names, time) => `${names} ${time} ਤੋਂ ਸਾਈਟ 'ਤੇ`,
      photoAdded: (time) => `${time} ਨੂੰ ਫੋਟੋ ਜੋੜੀ ਗਈ`,
      today: "ਅੱਜ",
      waitingOnStep: (title) => `ਇੰਤਜ਼ਾਰ: ${title}`,
      waitingOnExternal: (reason) => `ਇੰਤਜ਼ਾਰ: ${reason}`,
      waitingOnApproval: (label) => `ਤਬਦੀਲੀ ਆਰਡਰ ${label} ਦੀ ਤੁਹਾਡੀ ਮਨਜ਼ੂਰੀ ਦਾ ਇੰਤਜ਼ਾਰ`,
      waitingOnYou: "ਤੁਹਾਡੀ ਉਡੀਕ",
      reviewAndSign: "ਵੇਖੋ ਅਤੇ ਦਸਤਖਤ ਕਰੋ",
      datesNote: "ਤਾਰੀਖਾਂ ਟੀਮ ਦੀ ਯੋਜਨਾ ਹਨ ਅਤੇ ਬਦਲ ਸਕਦੀਆਂ ਹਨ।",
      changesHeading: "ਤੁਹਾਡੀ ਮਨਜ਼ੂਰੀ ਦੀ ਉਡੀਕ ਵਿੱਚ ਤਬਦੀਲੀਆਂ",
      approvedChange: (label, date) => `${label} ${date} ਨੂੰ ਮਨਜ਼ੂਰ`,
      stepsDone: (done, total) => `${total} ਵਿੱਚੋਂ ${done} ਕਦਮ ਪੂਰੇ`,
    },

    changeOrder: {
      kicker: "ਤਬਦੀਲੀ ਆਰਡਰ",
      toQuote: (number) => `ਕੋਟ ${number} ਲਈ`,
      forClient: (name) => `${name} ਲਈ`,
      originalLine: "ਅਸਲ ਲਾਈਨ",
      theChange: "ਤਬਦੀਲੀ",
      photo: (when) => `ਫੋਟੋ · ${when}`,
      quoteTotalAsApproved: (date) => (date ? `${date} ਨੂੰ ਮਨਜ਼ੂਰ ਕੋਟ ਦਾ ਕੁੱਲ` : "ਮਨਜ਼ੂਰ ਕੋਟ ਦਾ ਕੁੱਲ"),
      priorChanges: "ਪਹਿਲਾਂ ਮਨਜ਼ੂਰ ਤਬਦੀਲੀਆਂ",
      thisChange: "ਇਹ ਤਬਦੀਲੀ",
      taxOnChange: (rate) => `ਤਬਦੀਲੀ 'ਤੇ ${rate} ਟੈਕਸ`,
      taxUnknown: "ਇਸ ਤਬਦੀਲੀ 'ਤੇ ਟੈਕਸ ਇੱਥੇ ਨਹੀਂ ਦਿਖਾਇਆ ਗਿਆ; ਤੁਹਾਡਾ ਇਨਵੌਇਸ ਇਸਨੂੰ ਕੋਟ ਦੀ ਦਰ 'ਤੇ ਦੱਸੇਗਾ।",
      newTotal: "ਨਵਾਂ ਕੁੱਲ",
      schedule: "ਸਮਾਂ-ਸਾਰਣੀ",
      finishMoves: (from, to, days) => `ਪੂਰਾ ਹੋਣ ਦੀ ਤਾਰੀਖ ${from} ਤੋਂ ${to} ਹੋ ਜਾਂਦੀ ਹੈ (${days})`,
      finishMovesBy: (days) => `ਪੂਰਾ ਹੋਣ ਦੀ ਤਾਰੀਖ ${days} ਅੱਗੇ ਜਾਂਦੀ ਹੈ`,
      days: (n) => `${n > 0 ? "+" : "−"}${Math.abs(n)} ਦਿਨ`,
      scheduleUnchanged: "ਸਮਾਂ-ਸਾਰਣੀ ਵਿੱਚ ਕੋਈ ਤਬਦੀਲੀ ਨਹੀਂ",
      consent: (amount, total) => `ਮੈਂ ਟੈਕਸ ਸਮੇਤ ${amount} ਦੀ ਇਸ ਤਬਦੀਲੀ ਨੂੰ ਮਨਜ਼ੂਰੀ ਦਿੰਦਾ/ਦਿੰਦੀ ਹਾਂ, ਜਿਸ ਨਾਲ ਨਵਾਂ ਕੁੱਲ ${total} ਬਣਦਾ ਹੈ।`,
      consentSchedule: (days) => ` ਮੈਂ ਸਮਾਂ-ਸਾਰਣੀ ਦੀ ਤਬਦੀਲੀ (${days}) ਨੂੰ ਵੀ ਮਨਜ਼ੂਰੀ ਦਿੰਦਾ/ਦਿੰਦੀ ਹਾਂ।`,
      approveAndSign: "ਮਨਜ਼ੂਰ ਕਰੋ ਅਤੇ ਦਸਤਖਤ ਕਰੋ",
      askQuestion: "ਸਵਾਲ ਪੁੱਛੋ",
      footer: (company, phone) => `ਤੁਹਾਡੇ ਵੱਲੋਂ ਦਸਤਖਤ ਕੀਤਾ ਅਸਲ ਕੋਟ ਨਹੀਂ ਬਦਲਦਾ; ਇਹ ਜੋੜ ਉਸ ਵਿੱਚ ਸ਼ਾਮਲ ਹੁੰਦਾ ਹੈ। ਸਵਾਲ? ਸੁਨੇਹੇ ਦਾ ਜਵਾਬ ਦਿਓ ਜਾਂ ${company} ਨੂੰ${phone ? ` ${phone} 'ਤੇ` : ""} ਕਾਲ ਕਰੋ।`,
      approvedTitle: "ਮਨਜ਼ੂਰ — ਧੰਨਵਾਦ",
      approvedBody: (company) => `${company} ਕੋਲ ਤੁਹਾਡੀ ਦਸਤਖਤ ਕੀਤੀ ਮਨਜ਼ੂਰੀ ਹੈ ਅਤੇ ਉਹ ਤਬਦੀਲੀ 'ਤੇ ਕੰਮ ਜਾਰੀ ਰੱਖਣਗੇ।`,
      approvedOn: (date) => `${date} ਨੂੰ ਮਨਜ਼ੂਰ।`,
      withdrawnTitle: "ਇਹ ਤਬਦੀਲੀ ਵਾਪਸ ਲੈ ਲਈ ਗਈ",
      withdrawnBody: (company) => `${company} ਨੇ ਇਹ ਤਬਦੀਲੀ ਆਰਡਰ ਵਾਪਸ ਲੈ ਲਿਆ। ਤੁਹਾਡੇ ਕੋਟ ਵਿੱਚ ਕੁਝ ਨਹੀਂ ਬਦਲਦਾ।`,
      notFound: "ਇਹ ਲਿੰਕ ਸਹੀ ਨਹੀਂ ਹੈ।",
      notFoundBody: "ਜਿਸ ਕੰਪਨੀ ਨਾਲ ਤੁਸੀਂ ਕੰਮ ਕਰ ਰਹੇ ਹੋ ਉਸ ਨਾਲ ਸੰਪਰਕ ਕਰੋ, ਉਹ ਨਵਾਂ ਭੇਜ ਸਕਦੇ ਹਨ।",
      signFailed: "ਤੁਹਾਡੀ ਮਨਜ਼ੂਰੀ ਹੁਣੇ ਦਰਜ ਨਹੀਂ ਹੋ ਸਕੀ। ਥੋੜ੍ਹੀ ਦੇਰ ਬਾਅਦ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।",
      emailSubject: (label, company) => `${company} ਵੱਲੋਂ ${label} — ਕਿਰਪਾ ਕਰਕੇ ਵੇਖੋ ਅਤੇ ਦਸਤਖਤ ਕਰੋ`,
      emailIntro: (name, label, number) => `ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ ${name}, ਤੁਹਾਡੇ ਕੰਮ ਵਿੱਚ ਇੱਕ ਤਬਦੀਲੀ (${label}${number ? `, ਕੋਟ ${number}` : ""}) ਹੈ ਜਿਸ ਲਈ ਕੰਮ ਜਾਰੀ ਰੱਖਣ ਤੋਂ ਪਹਿਲਾਂ ਤੁਹਾਡੀ ਮਨਜ਼ੂਰੀ ਚਾਹੀਦੀ ਹੈ।`,
      emailButton: "ਵੇਖੋ ਅਤੇ ਦਸਤਖਤ ਕਰੋ",
      emailFooter: "ਜਦੋਂ ਤੱਕ ਤੁਸੀਂ ਦਸਤਖਤ ਨਹੀਂ ਕਰਦੇ, ਤੁਹਾਡੇ ਕੋਟ ਜਾਂ ਇਨਵੌਇਸ ਵਿੱਚ ਕੁਝ ਨਹੀਂ ਬਦਲਦਾ।",
      smsText: (company, label, url) => `${company}: ਤੁਹਾਡੇ ਕੰਮ ਲਈ ਤਬਦੀਲੀ ਆਰਡਰ ${label} ਨੂੰ ਤੁਹਾਡੀ ਮਨਜ਼ੂਰੀ ਚਾਹੀਦੀ ਹੈ — ਇੱਥੇ ਵੇਖੋ ਅਤੇ ਦਸਤਖਤ ਕਰੋ: ${url}`,
    },

    selfQuote: {
      documentWord: "ਬੇਨਤੀ",
      eyebrow: "ਹਵਾਲਾ ਮੰਗੋ",
      languageLabel: "ਭਾਸ਼ਾ",

      step1Title: "ਅਸੀਂ ਕਿਸ ਵਿੱਚ ਮਦਦ ਕਰ ਸਕਦੇ ਹਾਂ?",
      step1Hint: "ਸਭ ਤੋਂ ਨੇੜੇ ਦਾ ਚੁਣੋ — ਵੇਰਵੇ ਅਸੀਂ ਸੰਭਾਲ ਲਵਾਂਗੇ।",
      noServices: (phone) =>
        `ਇਸ ਕੰਪਨੀ ਨੇ ਹਾਲੇ ਆਪਣੀਆਂ ਸੇਵਾਵਾਂ ਸੈੱਟ ਨਹੀਂ ਕੀਤੀਆਂ। ਸਿੱਧਾ ਉਨ੍ਹਾਂ ਨਾਲ ਸੰਪਰਕ ਕਰੋ${phone ? ` ${phone} ਉੱਤੇ` : ""}।`,

      step2Hint: "ਲਗਭਗ ਅੰਕੜੇ ਵੀ ਠੀਕ ਹਨ — ਇੱਥੇ ਕੁਝ ਵੀ ਪੱਕਾ ਨਹੀਂ ਹੈ।",
      designKitchen: "ਖੁਦ ਬਣਾਉਣਾ ਚਾਹੁੰਦੇ ਹੋ? ਆਪਣੀ ਰਸੋਈ ਖੁਦ ਡਿਜ਼ਾਈਨ ਕਰੋ ਤੇ ਸਾਨੂੰ ਲੇਆਉਟ ਭੇਜੋ →",
      timelineLabel: "ਤੁਸੀਂ ਕਦੋਂ ਸ਼ੁਰੂ ਕਰਨਾ ਚਾਹੁੰਦੇ ਹੋ?",
      timelineAsap: "ਜਿੰਨੀ ਛੇਤੀ ਹੋ ਸਕੇ",
      timeline2Weeks: "2 ਹਫ਼ਤਿਆਂ ਦੇ ਅੰਦਰ",
      timeline1To3Months: "ਅਗਲੇ 1–3 ਮਹੀਨਿਆਂ ਵਿੱਚ",
      timelineExploring: "ਹਾਲੇ ਸਿਰਫ਼ ਪਤਾ ਕਰ ਰਿਹਾ/ਰਹੀ ਹਾਂ",
      budgetLabel: "ਲਗਭਗ ਬਜਟ?",
      optional: "(ਚੋਣਵਾਂ)",
      budgetUnder: (s) => `${s}1,000 ਤੋਂ ਘੱਟ`,
      budgetLow: (s) => `${s}1,000 – ${s}5,000`,
      budgetMid: (s) => `${s}5,000 – ${s}15,000`,
      budgetHigh: (s) => `${s}15,000 ਤੋਂ ਵੱਧ`,
      budgetUnsure: "ਹਾਲੇ ਪੱਕਾ ਨਹੀਂ",
      notesLabel: "ਹੋਰ ਕੁਝ ਜੋ ਸਾਨੂੰ ਪਤਾ ਹੋਣਾ ਚਾਹੀਦਾ ਹੈ?",
      notesPlaceholder: "ਫ਼ੋਟੋਆਂ, ਸਮਾਂ, ਪਹੁੰਚ, ਕੋਈ ਵੀ ਖ਼ਾਸ ਗੱਲ…",
      continueCta: "ਅੱਗੇ",

      step3Title: "ਅਸੀਂ ਇਹ ਕਿੱਥੇ ਭੇਜੀਏ?",
      step3Hint: "ਈਮੇਲ ਜਾਂ ਫ਼ੋਨ ਵਿੱਚੋਂ ਇੱਕ ਹੀ ਕਾਫ਼ੀ ਹੈ।",
      namePlaceholder: "ਤੁਹਾਡਾ ਨਾਮ",
      emailPlaceholder: "ਈਮੇਲ",
      phonePlaceholder: "ਫ਼ੋਨ",
      addressPlaceholder: "ਕੰਮ ਕਿੱਥੇ ਹੈ?",
      errAddress: "ਕਿਰਪਾ ਕਰਕੇ ਕੰਮ ਦਾ ਪਤਾ ਦੱਸੋ।",

      uploadLabel: "ਫ਼ੋਟੋਆਂ, ਵੀਡੀਓ ਜਾਂ PDF ਪਲਾਨ ਜੋੜੋ",
      uploadHint:
        "ਇੱਕ ਫ਼ੋਟੋ, ਛੋਟਾ ਕਲਿੱਪ ਜਾਂ ਤੁਹਾਡਾ PDF ਪਲਾਨ ਸਾਨੂੰ ਸਹੀ ਕੀਮਤ ਦੱਸਣ ਵਿੱਚ ਮਦਦ ਕਰਦਾ ਹੈ।",
      uploadDocumentFallback: "PDF ਪਲਾਨ",
      uploadBusy: "ਅੱਪਲੋਡ ਹੋ ਰਿਹਾ ਹੈ…",
      uploadLimit: (n) => `ਤੁਸੀਂ ${n} ਤੱਕ ਫਾਈਲਾਂ ਨੱਥੀ ਕਰ ਸਕਦੇ ਹੋ।`,
      uploadFailed:
        "ਅੱਪਲੋਡ ਅਸਫਲ — ਆਪਣਾ ਕੁਨੈਕਸ਼ਨ ਜਾਂਚੋ ਅਤੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।",
      uploadRejected: "ਉਹ ਫਾਈਲ ਅੱਪਲੋਡ ਨਹੀਂ ਹੋ ਸਕੀ।",
      uploadTooLarge: (size, limit) => `ਉਹ ਫਾਈਲ ${size} ਦੀ ਹੈ — ਇੱਕ ਵਾਰ ਵਿੱਚ ਵੱਧ ਤੋਂ ਵੱਧ ${limit} ਭੇਜੀ ਜਾ ਸਕਦੀ ਹੈ। ਫੋਟੋ ਛੋਟੇ ਆਕਾਰ ਵਿੱਚ ਲਓ, ਜਾਂ ਇਸਦਾ ਆਕਾਰ ਘਟਾ ਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।`,
      uploadRemove: "ਹਟਾਓ",
      back: "ਪਿੱਛੇ",
      sendCta: "ਮੇਰੀ ਬੇਨਤੀ ਭੇਜੋ",
      noObligation: (company) =>
        `ਕੋਈ ਪਾਬੰਦੀ ਨਹੀਂ। ${company} ਕੀਮਤ ਨਾਲ ਤੁਹਾਡੇ ਕੋਲ ਵਾਪਸ ਆਵੇਗੀ।`,

      errName: "ਕਿਰਪਾ ਕਰਕੇ ਸਾਨੂੰ ਆਪਣਾ ਨਾਮ ਦੱਸੋ।",
      errContact: "ਜਵਾਬ ਦੇਣ ਲਈ ਇੱਕ ਈਮੇਲ ਜਾਂ ਫ਼ੋਨ ਨੰਬਰ ਸ਼ਾਮਲ ਕਰੋ।",
      errSend: "ਤੁਹਾਡੀ ਬੇਨਤੀ ਭੇਜੀ ਨਹੀਂ ਜਾ ਸਕੀ।",
      linkInvalid: "ਇਹ ਲਿੰਕ ਵੈਧ ਨਹੀਂ ਹੈ।",
      linkInvalidHint: "ਲਿੰਕ ਦੀ ਜਾਂਚ ਕਰੋ, ਜਾਂ ਸਿੱਧਾ ਕੰਪਨੀ ਨਾਲ ਸੰਪਰਕ ਕਰੋ।",

      confirmTitle: "ਬੇਨਤੀ ਮਿਲ ਗਈ",
      confirmIntro: (company) =>
        `${company} ਕੋਲ ਹੇਠਾਂ ਦਿੱਤਾ ਸਭ ਕੁਝ ਹੈ ਅਤੇ ਉਹ ਕੀਮਤ ਨਾਲ ਸੰਪਰਕ ਕਰਨਗੇ।`,
      requestedHeading: "ਤੁਸੀਂ ਕੀ ਮੰਗਿਆ",
      nextHeading: "ਅੱਗੇ ਕੀ ਹੋਵੇਗਾ",
      next1Title: "ਉਹ ਇਸਨੂੰ ਪੜ੍ਹਨਗੇ",
      next1Body:
        "ਤੁਹਾਡੇ ਜਵਾਬ ਤੁਰੰਤ ਕੰਪਨੀ ਕੋਲ ਪਹੁੰਚ ਜਾਂਦੇ ਹਨ, ਨਾਲ ਹੀ ਜੋ ਕੁਝ ਤੁਸੀਂ ਨੱਥੀ ਕੀਤਾ।",
      next2Title: "ਉਹ ਕੀਮਤ ਲਾਉਣਗੇ",
      next2Body:
        "ਇੱਕ ਵਿਅਕਤੀ ਤੁਹਾਡੇ ਕੰਮ ਦੀ ਅਸਲ ਲਾਗਤ ਕੱਢਦਾ ਹੈ — ਇੱਥੇ ਕੁਝ ਵੀ ਆਪਣੇ ਆਪ ਕੀਮਤ ਨਹੀਂ ਲਾਈ ਗਈ।",
      next3Title: "ਤੁਹਾਨੂੰ ਹਵਾਲਾ ਮਿਲੇਗਾ",
      next3Body:
        "ਇਹ ਇੱਕ ਦਸਤਾਵੇਜ਼ ਵਜੋਂ ਆਉਂਦਾ ਹੈ ਜਿਸਨੂੰ ਤੁਸੀਂ ਪੜ੍ਹ, ਪੁੱਛ ਅਤੇ ਮਨਜ਼ੂਰ ਕਰ ਸਕਦੇ ਹੋ। ਉਸ ਤੋਂ ਪਹਿਲਾਂ ਕੁਝ ਤੈਅ ਨਹੀਂ ਹੁੰਦਾ।",
      estimateLabel: "ਅਨੁਮਾਨਿਤ ਦਾਇਰਾ",
      beforeTax: "ਟੈਕਸ ਤੋਂ ਪਹਿਲਾਂ",
      gatedNote:
        "ਹਾਲੇ ਕੋਈ ਕੀਮਤ ਨਹੀਂ ਦਿਖਾਈ ਗਈ — ਇਸ ਬੇਨਤੀ ਦੀ ਕੀਮਤ ਨਹੀਂ ਲਾਈ ਗਈ। ਇਹ ਜਾਣ-ਬੁੱਝ ਕੇ ਹੈ: ਜੋ ਅੰਕੜਾ ਤੁਹਾਨੂੰ ਮਿਲੇਗਾ, ਉਸ ਪਿੱਛੇ ਇੱਕ ਵਿਅਕਤੀ ਖੜ੍ਹਾ ਹੋਵੇਗਾ।",
      submittedLabel: "ਭੇਜੀ ਗਈ",
      copySentTo: (email) => `ਇੱਕ ਕਾਪੀ ${email} ਉੱਤੇ ਭੇਜੀ ਜਾ ਰਹੀ ਹੈ।`,
      callInstead: "ਹੋਰ ਛੇਤੀ ਚਾਹੀਦਾ ਹੈ?",
      // The in-person visit offered under the confirmation. Only rendered when
      // the company can actually take a booking — see lib/booking/canBookVisit.js.
      bookVisitTitle: "ਕੀ ਤੁਸੀਂ ਚਾਹੁੰਦੇ ਹੋ ਕਿ ਅਸੀਂ ਆ ਕੇ ਦੇਖੀਏ?",
      bookVisitBody:
        "ਘਰ ਆ ਕੇ ਦੇਖਣ ਦਾ ਸਮਾਂ ਬੁੱਕ ਕਰੋ — ਅਸੀਂ ਮੌਕੇ 'ਤੇ ਕੀਮਤ ਪੱਕੀ ਕਰਾਂਗੇ।",
      bookVisitCta: "ਵਿਜ਼ਿਟ ਬੁੱਕ ਕਰੋ",

      emailSubject: (company) => `${company} ਨੂੰ ਤੁਹਾਡੀ ਬੇਨਤੀ`,
      emailIntro: (company) =>
        `ਧੰਨਵਾਦ — ${company} ਕੋਲ ਤੁਹਾਡੀ ਬੇਨਤੀ ਪਹੁੰਚ ਗਈ ਹੈ। ਤੁਹਾਡੇ ਰਿਕਾਰਡ ਲਈ, ਤੁਸੀਂ ਜੋ ਭੇਜਿਆ ਉਹ ਇਹ ਹੈ।`,
    },

    visit: {
      eyebrow: "ਤੁਹਾਡੀ ਮੁਲਾਕਾਤ",
      loadFailed: "ਅਸੀਂ ਤੁਹਾਡੀ ਮੁਲਾਕਾਤ ਲੋਡ ਨਹੀਂ ਕਰ ਸਕੇ।",
      loadFailedHint:
        "ਆਪਣੀ ਈਮੇਲ ਵਿੱਚ ਦਿੱਤਾ ਲਿੰਕ ਦੁਬਾਰਾ ਵੇਖੋ, ਜਾਂ ਕੰਪਨੀ ਨਾਲ ਸਿੱਧਾ ਸੰਪਰਕ ਕਰੋ।",

      aboutEstimate: (number) => `ਤੁਹਾਡੇ ਹਵਾਲੇ ${number} ਬਾਰੇ`,

      whenLabel: "ਕਦੋਂ",
      whereLabel: "ਕਿੱਥੇ",
      modeVisit: "ਅਸੀਂ ਤੁਹਾਡੇ ਕੋਲ ਆ ਰਹੇ ਹਾਂ",
      modeCall: "ਫ਼ੋਨ ਕਾਲ — ਅਸੀਂ ਤੁਹਾਨੂੰ ਫ਼ੋਨ ਕਰਾਂਗੇ",
      modeVideo: "ਵੀਡੀਓ ਕਾਲ — ਅਸੀਂ ਈਮੇਲ ਰਾਹੀਂ ਲਿੰਕ ਭੇਜਾਂਗੇ",
      addressUnknown: "ਪਤਾ ਬਾਅਦ ਵਿੱਚ ਪੱਕਾ ਕੀਤਾ ਜਾਵੇਗਾ",
      depositPaid: (amount) => `${amount} ਪੇਸ਼ਗੀ ਅਦਾ ਕੀਤੀ ਗਈ`,

      changeHeading: "ਕੁਝ ਬਦਲਣਾ ਹੈ?",
      rescheduleCta: "ਸਮਾਂ ਬਦਲੋ",
      cancelCta: "ਇਹ ਮੁਲਾਕਾਤ ਰੱਦ ਕਰੋ",

      cannotCancelled: "ਇਹ ਮੁਲਾਕਾਤ ਪਹਿਲਾਂ ਹੀ ਰੱਦ ਹੋ ਚੁੱਕੀ ਹੈ।",
      cannotHappened: "ਇਹ ਮੁਲਾਕਾਤ ਪਹਿਲਾਂ ਹੀ ਹੋ ਚੁੱਕੀ ਹੈ।",
      cannotAwaitingPayment:
        "ਇਹ ਮੁਲਾਕਾਤ ਹਾਲੇ ਪੱਕੀ ਨਹੀਂ ਹੋਈ — ਭੁਗਤਾਨ ਪੂਰਾ ਨਹੀਂ ਹੋਇਆ।",
      cannotNotFound: "ਇਹ ਲਿੰਕ ਕਿਸੇ ਮੁਲਾਕਾਤ ਨਾਲ ਮੇਲ ਨਹੀਂ ਖਾਂਦਾ।",
      cannotTooLate: (notice, company) =>
        `${company} ਘੱਟੋ-ਘੱਟ ${notice} ਪਹਿਲਾਂ ਦੱਸਣ ਲਈ ਕਹਿੰਦੇ ਹਨ, ਇਸ ਲਈ ਇਹ ਮੁਲਾਕਾਤ ਹੁਣ ਇੱਥੋਂ ਨਹੀਂ ਬਦਲੀ ਜਾ ਸਕਦੀ।`,
      cannotTooLateNoNotice: (company) =>
        `ਹੁਣ ਤੁਹਾਡੀ ਮੁਲਾਕਾਤ ਇੰਨੀ ਨੇੜੇ ਹੈ ਕਿ ${company} ਇੱਥੋਂ ਤਬਦੀਲੀ ਨਹੀਂ ਲੈ ਸਕਦੇ।`,
      noticeHours: (n) => (n === 1 ? "1 ਘੰਟਾ" : `${n} ਘੰਟੇ`),
      callInstead: (company, phone) =>
        phone
          ? `${company} ਨੂੰ ${phone} 'ਤੇ ਫ਼ੋਨ ਕਰੋ — ਉਹ ਹਾਲੇ ਵੀ ਤੁਹਾਡੇ ਲਈ ਸਮਾਂ ਬਦਲ ਸਕਦੇ ਹਨ।`
          : `${company} ਨਾਲ ਸੰਪਰਕ ਕਰੋ — ਉਹ ਹਾਲੇ ਵੀ ਤੁਹਾਡੇ ਲਈ ਸਮਾਂ ਬਦਲ ਸਕਦੇ ਹਨ।`,

      refundYes: (amount) =>
        `ਤੁਹਾਡੀ ${amount} ਪੇਸ਼ਗੀ ਉਸੇ ਕਾਰਡ 'ਤੇ ਵਾਪਸ ਕੀਤੀ ਜਾਵੇਗੀ ਜਿਸ ਨਾਲ ਤੁਸੀਂ ਭੁਗਤਾਨ ਕੀਤਾ ਸੀ।`,
      refundNo: (amount) =>
        `ਤੁਹਾਡੀ ${amount} ਪੇਸ਼ਗੀ ਆਪਣੇ ਆਪ ਵਾਪਸ ਨਹੀਂ ਹੁੰਦੀ — ਇਸ ਬਾਰੇ ਉਨ੍ਹਾਂ ਨਾਲ ਸੰਪਰਕ ਕਰੋ।`,
      refundAlready: (amount) =>
        `ਤੁਹਾਡੀ ${amount} ਪੇਸ਼ਗੀ ਪਹਿਲਾਂ ਹੀ ਵਾਪਸ ਕਰ ਦਿੱਤੀ ਗਈ ਹੈ।`,

      cancelConfirmTitle: "ਇਹ ਮੁਲਾਕਾਤ ਰੱਦ ਕਰਨੀ ਹੈ?",
      cancelConfirmBody: (company) =>
        `${company} ਨੂੰ ਤੁਰੰਤ ਦੱਸ ਦਿੱਤਾ ਜਾਵੇਗਾ ਅਤੇ ਤੁਹਾਡਾ ਸਮਾਂ ਖਾਲੀ ਹੋ ਜਾਵੇਗਾ।`,
      yesCancel: "ਹਾਂ, ਰੱਦ ਕਰੋ",
      keepIt: "ਮੇਰੀ ਮੁਲਾਕਾਤ ਰਹਿਣ ਦਿਓ",
      cancelledTitle: "ਮੁਲਾਕਾਤ ਰੱਦ ਕੀਤੀ ਗਈ",
      cancelledBody: (company) =>
        `${company} ਨੂੰ ਦੱਸ ਦਿੱਤਾ ਗਿਆ ਹੈ। ਜੇ ਇਹ ਗਲਤੀ ਸੀ, ਤਾਂ ਉਨ੍ਹਾਂ ਨਾਲ ਸੰਪਰਕ ਕਰੋ ਅਤੇ ਉਹ ਤੁਹਾਨੂੰ ਹੋਰ ਸਮਾਂ ਦੇ ਦੇਣਗੇ।`,
      cancelledRefunded: (amount) =>
        `ਤੁਹਾਡੀ ${amount} ਪੇਸ਼ਗੀ ਵਾਪਸ ਆ ਰਹੀ ਹੈ। ਸਟੇਟਮੈਂਟ 'ਤੇ ਦਿਸਣ ਵਿੱਚ ਕੁਝ ਦਿਨ ਲੱਗ ਸਕਦੇ ਹਨ।`,

      rescheduleTitle: "ਨਵਾਂ ਸਮਾਂ ਚੁਣੋ",
      rescheduleKeep: "ਮੌਜੂਦਾ ਸਮਾਂ ਹੀ ਰੱਖੋ",
      findingTimes: "ਸਮਾਂ ਲੱਭ ਰਹੇ ਹਾਂ…",
      timesFailed: "ਅਸੀਂ ਇਸ ਵੇਲੇ ਉਪਲਬਧ ਸਮੇਂ ਲੋਡ ਨਹੀਂ ਕਰ ਸਕੇ।",
      pickADay: "ਸਮੇਂ ਵੇਖਣ ਲਈ ਇੱਕ ਦਿਨ ਚੁਣੋ।",
      morning: "ਸਵੇਰ",
      afternoon: "ਦੁਪਹਿਰ",
      evening: "ਸ਼ਾਮ",
      nothingThisMonth: "ਇਸ ਮਹੀਨੇ ਕੁਝ ਵੀ ਖਾਲੀ ਨਹੀਂ।",
      tryNextMonth: "ਅਗਲਾ ਮਹੀਨਾ ਵੇਖੋ",
      prevMonth: "ਪਿਛਲਾ ਮਹੀਨਾ",
      nextMonth: "ਅਗਲਾ ਮਹੀਨਾ",
      confirmNewTime: "ਮੇਰੀ ਮੁਲਾਕਾਤ ਇੱਥੇ ਕਰੋ",
      movedTitle: "ਤੁਹਾਡੀ ਮੁਲਾਕਾਤ ਬਦਲ ਦਿੱਤੀ ਗਈ",
      movedBody: (company) =>
        `${company} ਨੂੰ ਦੱਸ ਦਿੱਤਾ ਗਿਆ ਹੈ, ਅਤੇ ਨਵੀਂ ਪੁਸ਼ਟੀ ਤੁਹਾਨੂੰ ਭੇਜੀ ਜਾ ਰਹੀ ਹੈ।`,

      questions: (company, phone) =>
        phone
          ? `ਸਵਾਲ? ${company} ਨੂੰ ${phone} 'ਤੇ ਫ਼ੋਨ ਕਰੋ।`
          : `ਸਵਾਲ? ${company} ਨਾਲ ਸੰਪਰਕ ਕਰੋ।`,

      slotTaken: "ਇਹ ਸਮਾਂ ਹੁਣੇ ਕਿਸੇ ਹੋਰ ਨੇ ਲੈ ਲਿਆ ਹੈ। ਕੋਈ ਹੋਰ ਚੁਣੋ।",
      tooSoon:
        "ਇਹ ਸਮਾਂ ਉਨ੍ਹਾਂ ਨੂੰ ਕਾਫ਼ੀ ਪਹਿਲਾਂ ਨਹੀਂ ਦੱਸਦਾ। ਕੋਈ ਬਾਅਦ ਵਾਲਾ ਸਮਾਂ ਚੁਣੋ।",
      refundFailed:
        "ਅਸੀਂ ਇਸ ਵੇਲੇ ਤੁਹਾਡੀ ਪੇਸ਼ਗੀ ਵਾਪਸ ਨਹੀਂ ਕਰ ਸਕੇ, ਇਸ ਲਈ ਕੁਝ ਵੀ ਰੱਦ ਨਹੀਂ ਕੀਤਾ ਗਿਆ। ਥੋੜ੍ਹੀ ਦੇਰ ਬਾਅਦ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ, ਜਾਂ ਉਨ੍ਹਾਂ ਨਾਲ ਸੰਪਰਕ ਕਰੋ।",
    },
  },

  tl: {
    // "See the property" on /q/[token] — app/components/StreetViewPeek.js.
    streetView: { see: "Tingnan ang property", hide: "Itago", openInMaps: "Buksan sa Google Maps", frameTitle: "Street View ng property" },
    portalDocumentsHeading: "Mga dokumento",

    proposal: {
      contents: "Nilalaman",
      yourProject: "Ang iyong proyekto",
      aboutUs: "Tungkol sa amin",
      beforeAfter: "Bago at pagkatapos",
      importantDocuments: "Mahahalagang dokumento",
      testimonials: "Mga testimonya",
      services: "Mga serbisyo",
      scopeOfWork: "Saklaw ng trabaho",
      priceByArea: "Presyo bawat bahagi",
      quoteTotal: "Kabuuan ng quote",
      acceptQuote: "Tanggapin ang quote",
      day: (n) => `Araw ${n}`,
      crewOf: (n) => `Crew na ${n}`,
      halfDay: "Kalahating araw",
      paintLine: (products, coats) =>
        products && coats ? `Pintura: ${products} · ${coats}` : products ? `Pintura: ${products}` : coats,
      coats: (n) => (n === 1 ? "1 patong" : `${n} patong`),
      viewDocument: "Tingnan ang dokumento →",
      before: "Bago",
      after: "Pagkatapos",
      recentWork: "Kamakailang trabaho",
      documentsHeading: "Mga sertipiko at dokumento",
      whatClientsSaid: "Ang sinabi ng mga kliyente",
      whatElseWeDo: "Ano pa ang ginagawa namin",
      watchVideo: "Panoorin ang aming intro video",
      teamPhotoAlt: "Ang aming team",
    },
    // ── /estimate-report/[token] — the instant estimate as a proposal ─────
    // The same presentation as the quote, with the RANGE where the prices
    // would be (app/estimate-report/[token]/ReportView.js).
    rangeProposal: {
      yourEstimate: "Ang iyong estimate",
      estimateWord: "Estimate",
      estimatedRange: "Tinatayang saklaw",
      subjectToVisit: "Estimate — depende sa pagbisita sa lugar",
      rangeFor: (option) => `Para sa: ${option}`,
      rangeNote: (company) => `Batay sa mga detalyeng ibinigay mo. Kinukumpirma ng ${company} ang huling presyo matapos makita ang trabaho nang personal — walang pinal hangga't hindi mo inaaprubahan ang isang quote.`,
      noRange: (company) => `Kukumpirmahin ng ${company} ang iyong presyo matapos ang pagbisita sa lugar.`,
      whatHappensNext: "Ano ang susunod",
      bookVisit: "I-book ang pagbisita sa lugar",
      talkToUs: "Kausapin kami",
    },
    waiverKicker: "Waiver",
    waiverAttachedTo: (ref) => `Nakakabit sa ${ref}`,
    waiverIntro: "Basahin ang bawat seksyon at lagyan ng tsek na naiintindihan mo ito. Ang paglagda ay nasa dulo.",
    waiverAcknowledgements: "Mga pagkilala",
    waiverSign: "Lumagda",
    waiverAcknowledged: (n, total) => `${n} sa ${total} ang kinilala`,
    signWaiver: "Lagdaan ang waiver",
    waiverTickRemaining: (n) =>
      n === 1 ? "Lagyan ng tsek ang natitirang pagkilala para makalagda." : `Lagyan ng tsek ang natitirang ${n} pagkilala para makalagda.`,
    waiverConsent: "Sumasang-ayon ako na ang paglagda dito ay ang aking elektronikong lagda at nabasa at tinatanggap ko ang waiver na ito.",
    waiverSignedTitle: "Nalagdaan ang waiver — salamat",
    waiverSignedBody: (company) => `Ipinadala sa iyo ang kopya at naitala sa ${company}.`,
    waiverSignedOn: (date) => `Nilagdaan ${date}`,
    waiverSignedBy: (name, date) => `Nilagdaan ni ${name} noong ${date}`,
    waiverAfterNote: "Kapag nalagdaan, ipapadala sa iyo ang kopya na may petsa, iyong pangalan at bawat pagkilala, at itatala sa trabahong ito. Hiwalay na nilalagdaan ang quote.",
    waiverRequiredBeforeApprove: "Lagdaan muna ang nakakabit na waiver bago aprubahan ang quote na ito.",
    waiverCopyIntro: (company) => `Nakakabit ang iyong nilagdaang kopya ng waiver para sa ${company}.`,
    waiverLinkIntro: (company, title) => `May dokumento ang ${company} na babasahin at lalagdaan mo: "${title}". Isang minuto lang.`,
    waiverOpen: "Basahin at lagdaan",
    approveThisQuote: "Aprubahan ang quote na ito",
    decline: "Tanggihan",
    whatsIncluded: "Ano ang kasama",
    whatCouldChange: "Ano ang maaaring magbago sa presyong ito",
    termsExplained: "Ang mga termino sa quote na ito, ipinaliwanag",
    optionalExtras: "Mga opsyonal na dagdag",
    extrasTickHint:
      "Lagyan ng tsek ang gusto ninyong idagdag. Nag-a-update ang kabuuan habang pinipili — walang sisingilin hangga't hindi ninyo ito inaaprubahan.",
    extrasChosen: "Napili nang aprubahan ang quote na ito.",
    includesOptionalExtras: "Kasama ang mga opsyonal na dagdag",
    payOfflineHint: "Magbabayad ka sa e-transfer o tseke sa halip na card.",
    howTheWorkRuns: "Paano isasagawa ang trabaho",
    paymentTerms: "Mga tuntunin ng pagbabayad",
    yourFullName: "Buong pangalan ninyo",
    typeYourName: "I-type ang pangalan ninyo",
    signature: "Lagda",
    signatureConsent: (total) =>
      `Sang-ayon ako na ang paglagda dito ay aking elektronikong lagda at nag-aapruba sa quote na ito para sa ${total}.`,
    approveConfirm: (total) => `Aprubahan ang quote na ito para sa ${total}?`,
    declineConfirm: "Tanggihan ang quote na ito?",
    approveSubExtras: (extras) =>
      `Kasama ang ${extras} na opsyonal na dagdag. Ito ang senyales para magpatuloy sila.`,
    approveSubPlain: "Ito ang senyales para magpatuloy sila.",
    declineSub: "Maaari kayong humingi ng binagong quote anumang oras.",
    yesApprove: "Oo, aprubahan",
    yesDecline: "Oo, tanggihan",
    goBack: "Bumalik",
    approvedTitle: "Naaprubahan — salamat",
    approvedBody: (company) =>
      `Naabisuhan na ang ${company} at makikipag-ugnayan sila tungkol sa mga susunod na hakbang.`,
    declinedTitle: "Tinanggihan ang quote",
    declinedBody: (company) =>
      `Naabisuhan na ang ${company}. Kung nagkamali, tawagan sila.`,
    expiredTitle: "Nag-expire na ang quote na ito",
    expiredBody: (company) =>
      `Makipag-ugnayan sa ${company} para sa napapanahong presyo.`,
    approvedCopyIntro: (company) =>
      `Salamat sa pag-apruba ng inyong quote sa ${company}. May nakalakip na kopya para sa inyong tala.`,
    measuredAt: (address) => `Sinukat sa: ${address}`,
    genericError: "May nangyaring mali. Subukan muli.",
    connectionLost: "Hindi namin ma-load ang iyong quote.",
    connectionLostHint:
      "Maaaring nawalan ka ng signal. Suriin ang iyong koneksyon at subukan muli — walang naipadala.",
    tryAgain: "Subukan muli",
    linkInvalidHint:
      "Makipag-ugnayan sa kompanyang nagpadala nito at makakapagpadala sila ng bagong link.",

    financingAvailable: "Financing",
    financingHeading: "Buwanang bayad",
    financingMonthly: (monthly) => `Humigit-kumulang ${monthly} kada buwan`,
    financingTermsLine: (months, apr) =>
      `Tantiya sa loob ng ${months} buwan sa ${apr} na APR.`,
    financingEstimateNote: (company) =>
      `Tantiya lamang ito, batay sa mga tuntuning ibinigay ng ${company} at sa kabuuang nasa itaas. Ang aktwal na rate, hulog at pag-apruba ay kinukumpirma ng inyong financing provider kapag nag-apply kayo.`,
    financingCta: "Tingnan ang mga opsyon sa financing",
    quoteQuestions: (company, phone) =>
      phone
        ? `May tanong? I-reply ang email, o tawagan ang ${company} sa ${phone}.`
        : `May tanong? I-reply ang email, o tawagan ang ${company}.`,

    accountFor: (name) => `Account ni ${name}`,
    balanceOwing: "Natitirang babayaran",
    nothingOutstanding: "Walang natitira. Salamat.",
    acrossInvoices: (n) => `Sa ${n} na invoice.`,
    invoicesHeading: "Mga invoice",
    quotesHeading: "Mga quote",
    paidNote: (amount) => `${amount} bayad na`,
    dueNote: (date) => `dapat bayaran ${date}`,
    pay: (amount) => `Magbayad ng ${amount}`,
    paid: "Bayad na",
    review: "Tingnan",
    // Keyed by the QuoteStatus enum — see the note in the `en` block.
    quoteStatus: {
      draft: "Draft",
      sent: "Hinihintay ang sagot ninyo",
      accepted: "Naaprubahan",
      declined: "Tinanggihan",
    },
    paymentReceived:
      "Natanggap ang bayad — salamat. Maaaring tumagal ng isang minuto bago lumabas sa ibaba.",
    payCard: (amount) => `Magbayad ng ${amount} gamit ang card`,
    payBank: (amount) => `Magbayad ng ${amount} mula sa bank account`,
    bankNote: "Ang bayad mula sa bangko ay tumatagal ng 3–5 araw ng negosyo bago ma-clear. Hanggang doon, lalabas na pending ang invoice.",
    bankPendingBanner: "Natanggap ang bayad mula sa bangko — tumatagal ito ng 3–5 araw ng negosyo bago ma-clear. Lalabas na bayad na ang invoice pagkatapos.",
    bankPending: "Pending ang bayad mula sa bangko",
    bankFailed: (reason) => `Hindi natuloy ang bayad mula sa bangko${reason ? ` — ${reason}` : ""}. Maaari mong subukan muli o magbayad gamit ang card.`,
    bankOverCap: (max, amount) => `Ang bank debit ay hanggang ${max} lang bawat bayad — ${amount} ang invoice na ito, kaya card lang.`,
    paymentNotStarted: (company) => `Hindi masimulan ang bayad na ito — subukan gamit ang card, o makipag-ugnayan sa ${company}.`,
    portalQuestions: (company, phone, email) =>
      `May tanong tungkol dito? Makipag-ugnayan sa ${company}${phone ? ` sa ${phone}` : ""}${email ? ` · ${email}` : ""}.`,

    backToAccount: "Bumalik sa account ninyo",
    due: "Dapat bayaran",
    wasDue: "Dapat sana",
    noItemisedBreakdown: "Walang detalyadong breakdown sa invoice na ito.",
    paidInFull: "Bayad nang buo",
    paidInFullThanks: "Bayad nang buo — salamat",
    invoiceNotFound: "Wala ang invoice na iyon sa account ninyo.",
    arrangePayment: "Makipag-ugnayan po sa amin para maayos ang bayad.",
    acceptedMethods: (methods) => `Tinatanggap: ${methods}.`,

    portal: {
      nextVisitKicker: "Susunod na pagbisita",
      planKicker: "Ang iyong plan",
      upcomingHeading: "Mga paparating na pagbisita",
      pastHeading: "Mga nakaraang pagbisita",
      between: (from, to) => `sa pagitan ng ${from} at ${to}`,
      at: (time) => `nang ${time}`,
      withCrew: (name) => `kasama si ${name}`,
      typeVisit: "Pagbisita",
      typeReturn: "Balik-pagbisita",
      typeAppointment: "Appointment",
      typeCall: "Tawag sa telepono",
      typeVideo: "Video call",
      frequency: {
        weekly: "Bawat linggo",
        monthly: "Bawat buwan",
        quarterly: "Bawat 3 buwan",
        semiannual: "Dalawang beses sa isang taon",
        annual: "Isang beses sa isang taon",
      },
      perVisit: (amount) => `${amount} bawat pagbisita`,
      taxIncluded: "kasama ang buwis",
      memberDiscount: (pct) => `Kasama ang iyong ${pct}% na diskwento sa plan`,
      included: "Ano ang kasama",
      nextDates: "Mga susunod na petsa",
      endsOn: (date) => `Tatagal ang plan hanggang ${date}`,
      visitsSold: (n) => (n === 1 ? "1 pagbisita sa plan na ito" : `${n} pagbisita sa plan na ito`),
      reschedule: "Humiling na ilipat ang petsa",
      skip: "Laktawan ang pagbisitang ito",
      rescheduleQuestion: "Ano ang mas angkop para sa iyo?",
      skipQuestion: "May dapat ba kaming malaman? (opsyonal)",
      requestPlaceholder: "Halimbawa: kahit anong araw ng linggo pagkatapos ng ika-20",
      requestExplain: (company) => `Babalikan ka ng ${company}. Walang magbabago hangga't hindi nila kinukumpirma.`,
      requestSend: "Ipadala ang kahilingan",
      cancel: "Kanselahin",
      requested: "Naipadala ang kahilingan",
      requestTooLate: "Masyadong malapit na ang pagbisitang ito para baguhin dito. Pakitawagan na lang.",
      requestFailed: "Hindi naipadala ang iyong kahilingan. Subukan muli, o tumawag.",
      callToChange: "Wala nang isang araw. Tumawag para baguhin ito.",
      photoAlt: "Litrato mula sa pagbisitang ito",
      loginEmailSubject: (company) => `Ang iyong account sa ${company}`,
      loginEmailLabel: "Ang iyong account",
      loginEmailGreeting: (first) => (first ? `Hi ${first},` : "Hello,"),
      loginEmailIntro: (company) => `Narito ang link sa iyong account sa ${company}: ang iyong mga quote, invoice, pagbisita at plan sa iisang lugar.`,
      loginEmailButton: "Buksan ang iyong account",
      loginEmailKeep: "Personal sa iyo ang link na ito. Huwag itong ibahagi, at i-bookmark ito para makabalik anumang oras.",
      loginEmailIgnore: "Kung hindi mo hiniling ang link na ito, maaari mong balewalain ang email na ito. Walang nagbago sa iyong account.",
      rescheduleSubject: (what, date) => `Ilipat ang ${what} sa ${date}`,
      skipSubject: (what, date) => `Laktawan ang ${what} sa ${date}`,
      requestNoMessage: "Walang mensahe — pakimungkahi ng ibang petsa.",
      maintenanceSubject: (plan) => `I-book ang susunod kong pagbisita — ${plan}`,
      preferredLine: (when) => `Angkop sa akin: ${when}`,
      maintenanceNoNote: "Pakimungkahi ng petsa para sa susunod kong kasamang pagbisita.",
      ticketReplySubject: (subject) => `Re: ${subject}`,
      ticketReplyIntro: (who, subject) => `Sumagot si ${who} tungkol sa “${subject}”:`,
      ticketReplyButton: "Tingnan at sumagot",
      ticketEmailLabel: "Ang iyong kahilingan",
      tickets: {
        heading: "Ang iyong mga kahilingan",
        reportIssue: "Mag-ulat ng problema",
        requestWork: "Humiling ng trabaho",
        reportOnVisit: "Mag-ulat ng problema",
        reportTitle: "Mag-ulat ng problema",
        aboutVisit: (date) => `Tungkol sa pagbisita noong ${date}`,
        typeLabel: "Tungkol saan ito?",
        types: {
          repair: "May kailangang ayusin",
          warranty: "Claim sa warranty",
          question: "Isang tanong",
          billing: "Singil",
          reschedule: "Baguhin ang petsa",
          maintenance: "Pagbisita sa maintenance",
        },
        subjectLabel: "Maikling buod",
        bodyLabel: "Sabihin sa amin ang nangyayari",
        photosLabel: "Mga litrato (opsyonal)",
        addPhoto: "Magdagdag ng litrato",
        uploading: "Ina-upload…",
        uploadFailed: "Hindi ma-upload ang litratong iyon.",
        send: "Ipadala",
        cancel: "Kanselahin",
        sent: (company) => `Naipadala. Sasagot ang ${company} dito at sa email.`,
        failed: "Hindi naipadala. Pakisubukan muli.",
        status: {
          open: "Natanggap",
          in_progress: "Ginagawa na",
          waiting_on_client: "Hinihintay ka",
          resolved: "Nalutas",
          closed: "Sarado",
        },
        you: "Ikaw",
        replyPlaceholder: "Sumulat ng sagot…",
        sendReply: "Ipadala ang sagot",
        closedNote: "Sarado na ang kahilingang ito. Mag-ulat ng bagong problema kung may iba pang lumitaw.",
        workTitle: "Humiling ng trabaho",
        workNewJob: "Bagong trabaho o quote",
        workMaintenance: "Pagbisita sa maintenance",
        workService: "Aling serbisyo?",
        workServiceOther: "Iba pa",
        workDescribe: "Ilarawan ang trabaho",
        workDates: "Gustong petsa (opsyonal)",
        workDatesPlaceholder: "Halimbawa: kahit anong araw ng linggo sa unang bahagi ng Nobyembre",
        workSent: (company) => `Naipadala. Babalikan ka ng ${company} para kumpirmahin. Walang naka-book o nasisingil hangga't hindi nila ginagawa.`,
        workPlan: "Aling plan?",
        workRemaining: (n) => (n === 1 ? "1 kasamang pagbisita ang natitira" : `${n} kasamang pagbisita ang natitira`),
        workUntilCancelled: "Tuloy ang mga pagbisita hanggang matapos ang plan",
        workWindow: "Kailan angkop sa iyo?",
        workWindowPlaceholder: "Halimbawa: umaga, sa linggo ng ika-10",
        workNote: "May iba pa? (opsyonal)",
        workSetupIntro: (company) => `Wala ka pang maintenance plan. Sabihin sa ${company} kung ano ang gusto mong regular na alagaan at gaano kadalas, at babalikan ka nila ng mga opsyon.`,
        workSetupDescribe: "Ano ang dapat alagaan, at gaano kadalas?",
        workConfirmNote: (company) => `Kinukumpirma ng ${company} ang lahat bago mag-book. Walang naiiskedyul o nasisingil mula rito.`,
      },
    },

    job: {
      kicker: "Ang trabaho mo",
      dayOf: (day, total) => `Araw ${day} ng ${total}`,
      onSchedule: "nasa iskedyul",
      runningLate: "nahuhuli",
      finished: "Tapos na",
      started: (date) => `Nagsimula ${date}`,
      finishPlanned: (date) => `Planong matapos ${date}`,
      datesToConfirm: "Kukumpirmahin pa ang mga petsa",
      done: "Tapos",
      inProgress: "Ginagawa",
      waitingOn: "Naghihintay sa",
      upNext: "Susunod",
      photos: (n) => (n === 1 ? "1 larawan" : `${n} larawan`),
      onSiteSince: (names, time) => `${names} nasa site mula ${time}`,
      photoAdded: (time) => `Nagdagdag ng larawan ${time}`,
      today: "Ngayon",
      waitingOnStep: (title) => `Naghihintay sa: ${title}`,
      waitingOnExternal: (reason) => `Naghihintay sa: ${reason}`,
      waitingOnApproval: (label) => `Naghihintay sa pag-apruba mo ng change order ${label}`,
      waitingOnYou: "Naghihintay sa iyo",
      reviewAndSign: "Suriin at pirmahan",
      datesNote: "Ang mga petsa ay plano ng crew at maaaring magbago.",
      changesHeading: "Mga pagbabagong naghihintay ng pag-apruba mo",
      approvedChange: (label, date) => `${label} inaprubahan ${date}`,
      stepsDone: (done, total) => `${done} sa ${total} hakbang ang tapos`,
    },

    changeOrder: {
      kicker: "Change order",
      toQuote: (number) => `sa quote ${number}`,
      forClient: (name) => `Para kay ${name}`,
      originalLine: "Orihinal na linya",
      theChange: "Ang pagbabago",
      photo: (when) => `Larawan · ${when}`,
      quoteTotalAsApproved: (date) => (date ? `Kabuuan ng quote na inaprubahan ${date}` : "Kabuuan ng inaprubahang quote"),
      priorChanges: "Mga pagbabagong naaprubahan na",
      thisChange: "Ang pagbabagong ito",
      taxOnChange: (rate) => `${rate} buwis sa pagbabago`,
      taxUnknown: "Hindi ipinapakita rito ang buwis sa pagbabagong ito; isasaad ito ng invoice mo sa rate ng quote.",
      newTotal: "Bagong kabuuan",
      schedule: "Iskedyul",
      finishMoves: (from, to, days) => `Lilipat ang pagtatapos mula ${from} papuntang ${to} (${days})`,
      finishMovesBy: (days) => `Lilipat ang pagtatapos nang ${days}`,
      days: (n) => (n === 1 || n === -1 ? `${n > 0 ? "+" : "−"}1 araw` : `${n > 0 ? "+" : "−"}${Math.abs(n)} araw`),
      scheduleUnchanged: "Walang pagbabago sa iskedyul",
      consent: (amount, total) => `Inaaprubahan ko ang pagbabagong ito sa halagang ${amount} kasama ang buwis, kaya ang bagong kabuuan ay ${total}.`,
      consentSchedule: (days) => ` Inaaprubahan ko rin ang pagbabago sa iskedyul (${days}).`,
      approveAndSign: "Aprubahan at pirmahan",
      askQuestion: "Magtanong",
      footer: (company, phone) => `Hindi nagbabago ang orihinal na quote na pinirmahan mo; idinaragdag dito ang addendum na ito. May tanong? Sumagot sa text, o tumawag sa ${company}${phone ? ` sa ${phone}` : ""}.`,
      approvedTitle: "Naaprubahan — salamat",
      approvedBody: (company) => `Natanggap ng ${company} ang pirmado mong pag-apruba at itutuloy ang pagbabago.`,
      approvedOn: (date) => `Naaprubahan ${date}.`,
      withdrawnTitle: "Binawi ang pagbabagong ito",
      withdrawnBody: (company) => `Binawi ng ${company} ang change order na ito. Walang nagbabago sa quote mo.`,
      notFound: "Hindi wasto ang link na ito.",
      notFoundBody: "Makipag-ugnayan sa kumpanyang katrabaho mo at makakapagpadala sila ng bago.",
      signFailed: "Hindi naitala ang pag-apruba mo ngayon. Subukan ulit maya-maya.",
      emailSubject: (label, company) => `${label} mula sa ${company} — pakisuri at pirmahan`,
      emailIntro: (name, label, number) => `Hi ${name}, may pagbabago sa trabaho mo (${label}${number ? `, quote ${number}` : ""}) na kailangan ng pag-apruba mo bago ituloy ang gawain.`,
      emailButton: "Suriin at pirmahan",
      emailFooter: "Walang nagbabago sa quote o invoice mo hangga't hindi ka pumipirma.",
      smsText: (company, label, url) => `${company}: kailangan ng pag-apruba mo ang change order ${label} para sa trabaho mo — suriin at pirmahan dito: ${url}`,
    },

    selfQuote: {
      documentWord: "Kahilingan",
      eyebrow: "Humiling ng quote",
      languageLabel: "Wika",

      step1Title: "Ano ang maitutulong namin?",
      step1Hint: "Piliin ang pinakamalapit — kami na ang bahala sa detalye.",
      noServices: (phone) =>
        `Hindi pa naisaayos ng kumpanyang ito ang kanilang mga serbisyo. Makipag-ugnayan nang diretso sa kanila${phone ? ` sa ${phone}` : ""}.`,

      step2Hint: "Tantiya lang ay sapat na — walang binding dito.",
      designKitchen: "Mas gusto mong iguhit? I-design mo mismo ang iyong kusina at ipadala sa amin ang layout →",
      timelineLabel: "Kailan ninyo balak magsimula?",
      timelineAsap: "Sa lalong madaling panahon",
      timeline2Weeks: "Sa loob ng 2 linggo",
      timeline1To3Months: "Sa susunod na 1–3 buwan",
      timelineExploring: "Nagtatanong pa lang sa ngayon",
      budgetLabel: "Tantiyang budget?",
      optional: "(opsyonal)",
      budgetUnder: (s) => `Mababa sa ${s}1,000`,
      budgetLow: (s) => `${s}1,000 – ${s}5,000`,
      budgetMid: (s) => `${s}5,000 – ${s}15,000`,
      budgetHigh: (s) => `${s}15,000 pataas`,
      budgetUnsure: "Hindi pa sigurado",
      notesLabel: "May iba pa bang dapat naming malaman?",
      notesPlaceholder: "Mga larawan, oras, daanan, anumang hindi karaniwan…",
      continueCta: "Magpatuloy",

      step3Title: "Saan namin ipapadala?",
      step3Hint: "Sapat na ang email o telepono.",
      namePlaceholder: "Pangalan ninyo",
      emailPlaceholder: "Email",
      phonePlaceholder: "Telepono",
      addressPlaceholder: "Saan ang trabaho?",
      errAddress: "Pakisabi ang address ng trabaho.",

      uploadLabel: "Magdagdag ng mga larawan, video o PDF na plano",
      uploadHint:
        "Nakakatulong ang larawan, maikling clip o ang PDF mong plano para tumpak ang aming presyo.",
      uploadDocumentFallback: "PDF na plano",
      uploadBusy: "Ina-upload…",
      uploadLimit: (n) => `Puwede kang maglakip ng hanggang ${n} na file.`,
      uploadFailed:
        "Nabigo ang pag-upload — suriin ang iyong koneksyon at subukan muli.",
      uploadRejected: "Hindi na-upload ang file na iyon.",
      uploadTooLarge: (size, limit) => `${size} ang file na iyon — ${limit} lang ang kayang ipadala sa isang upload. Kunan ng mas maliit na laki ang larawan, o i-resize ito at subukan ulit.`,
      uploadRemove: "Alisin",
      back: "Bumalik",
      sendCta: "Ipadala ang kahilingan ko",
      noObligation: (company) =>
        `Walang obligasyon. Babalikan kayo ng ${company} na may presyo.`,

      errName: "Pakisabi po ang pangalan ninyo.",
      errContact:
        "Magdagdag ng email o numero ng telepono para makasagot kami.",
      errSend: "Hindi naipadala ang kahilingan ninyo.",
      linkInvalid: "Hindi wasto ang link na ito.",
      linkInvalidHint:
        "Suriin ang link, o makipag-ugnayan nang diretso sa kumpanya.",

      confirmTitle: "Natanggap ang kahilingan",
      confirmIntro: (company) =>
        `Nasa ${company} na ang lahat ng nasa ibaba at babalikan kayo nila na may presyo.`,
      requestedHeading: "Ang hiniling ninyo",
      nextHeading: "Ano ang susunod",
      next1Title: "Babasahin nila ito",
      next1Body:
        "Diretsong dumarating sa kumpanya ang mga sagot ninyo, kasama ang anumang inilakip ninyo.",
      next2Title: "Pipresyuhan nila ito",
      next2Body:
        "May taong kumakalkula ng tunay na halaga ng trabaho ninyo — walang awtomatikong pagpepresyo dito.",
      next3Title: "Makakatanggap kayo ng quote",
      next3Body:
        "Darating ito bilang dokumento na mababasa, matatanong at maaaprubahan ninyo. Walang napagkakasunduan hangga't hindi ninyo ginagawa iyon.",
      estimateLabel: "Tantiyang saklaw",
      beforeTax: "bago ang buwis",
      gatedNote:
        "Wala pang presyong ipinapakita — hindi pa napepresyuhan ang kahilingang ito. Sinadya iyon: ang halagang matatanggap ninyo ay isang panindigan ng tao.",
      submittedLabel: "Ipinadala noong",
      copySentTo: (email) => `Papadala na ang kopya sa ${email}.`,
      callInstead: "Kailangan ninyo agad?",
      // The in-person visit offered under the confirmation. Only rendered when
      // the company can actually take a booking — see lib/booking/canBookVisit.js.
      bookVisitTitle: "Gusto ninyo bang puntahan namin?",
      bookVisitBody:
        "Mag-book ng personal na pagbisita at kumpirmahin namin ang presyo ninyo doon mismo.",
      bookVisitCta: "Mag-book ng pagbisita",

      emailSubject: (company) => `Ang kahilingan ninyo sa ${company}`,
      emailIntro: (company) =>
        `Salamat — natanggap na ng ${company} ang kahilingan ninyo. Narito ang ipinadala ninyo, para sa talaan ninyo.`,
    },

    visit: {
      eyebrow: "Ang inyong pagbisita",
      loadFailed: "Hindi namin ma-load ang inyong pagbisita.",
      loadFailedHint:
        "Tingnan ulit ang link sa email ninyo, o direktang makipag-ugnayan sa kumpanya.",

      aboutEstimate: (number) => `Tungkol sa inyong quote ${number}`,

      whenLabel: "Kailan",
      whereLabel: "Saan",
      modeVisit: "Pupunta kami sa inyo",
      modeCall: "Tawag sa telepono — tatawagan namin kayo",
      modeVideo: "Video call — magpapadala kami ng link sa email",
      addressUnknown: "Kukumpirmahin pa ang address",
      depositPaid: (amount) => `Bayad na ang ${amount} na deposito`,

      changeHeading: "May gusto kayong baguhin?",
      rescheduleCta: "Palitan ang oras",
      cancelCta: "Kanselahin ang pagbisitang ito",

      cannotCancelled: "Nakansela na ang pagbisitang ito.",
      cannotHappened: "Naganap na ang pagbisitang ito.",
      cannotAwaitingPayment:
        "Hindi pa kumpirmado ang pagbisitang ito — hindi pa natatapos ang bayad.",
      cannotNotFound: "Walang pagbisitang tumutugma sa link na ito.",
      cannotTooLate: (notice, company) =>
        `Humihingi ang ${company} ng abiso nang hindi bababa sa ${notice}, kaya hindi na ito mababago rito.`,
      cannotTooLateNoNotice: (company) =>
        `Masyado nang malapit ang inyong appointment para tanggapin dito ng ${company} ang pagbabago.`,
      noticeHours: (n) => (n === 1 ? "1 oras" : `${n} oras`),
      callInstead: (company, phone) =>
        phone
          ? `Tawagan ang ${company} sa ${phone} — maaari pa rin nilang ilipat ito para sa inyo.`
          : `Makipag-ugnayan sa ${company} — maaari pa rin nilang ilipat ito para sa inyo.`,

      refundYes: (amount) =>
        `Ibabalik ang inyong ${amount} na deposito sa card na ginamit ninyong pambayad.`,
      refundNo: (amount) =>
        `Hindi awtomatikong naibabalik ang inyong ${amount} na deposito — makipag-ugnayan sa kanila tungkol dito.`,
      refundAlready: (amount) =>
        `Naibalik na ang inyong ${amount} na deposito.`,

      cancelConfirmTitle: "Kanselahin ang pagbisitang ito?",
      cancelConfirmBody: (company) =>
        `Agad na maaabisuhan ang ${company}, at mababakante ang oras ninyo.`,
      yesCancel: "Oo, kanselahin",
      keepIt: "Panatilihin ang pagbisita ko",
      cancelledTitle: "Nakansela ang pagbisita",
      cancelledBody: (company) =>
        `Naabisuhan na ang ${company}. Kung nagkamali kayo, makipag-ugnayan sa kanila at ihahanap nila kayo ng ibang oras.`,
      cancelledRefunded: (amount) =>
        `Pabalik na ang inyong ${amount} na deposito. Maaaring tumagal ng ilang araw bago ito lumabas sa statement ninyo.`,

      rescheduleTitle: "Pumili ng bagong oras",
      rescheduleKeep: "Panatilihin ang kasalukuyang oras",
      findingTimes: "Naghahanap ng oras…",
      timesFailed: "Hindi namin ma-load ang mga available na oras ngayon.",
      pickADay: "Pumili ng araw para makita ang mga oras.",
      morning: "Umaga",
      afternoon: "Hapon",
      evening: "Gabi",
      nothingThisMonth: "Walang bakante ngayong buwan.",
      tryNextMonth: "Subukan ang susunod na buwan",
      prevMonth: "Nakaraang buwan",
      nextMonth: "Susunod na buwan",
      confirmNewTime: "Ilipat dito ang pagbisita ko",
      movedTitle: "Nailipat na ang inyong pagbisita",
      movedBody: (company) =>
        `Naabisuhan na ang ${company}, at padating na ang bagong kumpirmasyon ninyo.`,

      questions: (company, phone) =>
        phone
          ? `May tanong? Tawagan ang ${company} sa ${phone}.`
          : `May tanong? Makipag-ugnayan sa ${company}.`,

      slotTaken: "Kakakuha lang sa oras na iyon. Pumili ng iba.",
      tooSoon:
        "Masyadong maikli ang abiso sa oras na iyon. Pumili ng mas huli.",
      refundFailed:
        "Hindi namin naibalik ang deposito ninyo ngayon, kaya walang nakanselang anuman. Subukan ulit maya-maya, o makipag-ugnayan sa kanila.",
    },
  },

  // ── German, formal ────────────────────────────────────────────────────────
  //
  // `Sie` throughout, matching the German app catalogue and marketing copy.
  //
  // Two vocabulary decisions worth stating, because both could reasonably have
  // gone the other way and a later editor should not "fix" them:
  //
  //   annehmen, not freigeben — the app catalogue uses "Freigabe" for the
  //     INTERNAL step where a colleague releases a price, and "angenommen" for
  //     what a client does to a quote. Every button here is the client's act.
  //   Termin, not Besuch — the same record covers a site visit, a phone call
  //     and a video call (modeVisit/modeCall/modeVideo below). "Besuch" is only
  //     true for one of the three; "Termin" is true for all of them, which is
  //     what French already does with "rendez-vous".
  de: {
    // "See the property" on /q/[token] — app/components/StreetViewPeek.js.
    streetView: { see: "Immobilie ansehen", hide: "Ausblenden", openInMaps: "In Google Maps öffnen", frameTitle: "Street View der Immobilie" },
    portalDocumentsHeading: "Dokumente",

    proposal: {
      contents: "Inhalt",
      yourProject: "Ihr Projekt",
      aboutUs: "Über uns",
      beforeAfter: "Vorher / Nachher",
      importantDocuments: "Wichtige Dokumente",
      testimonials: "Kundenstimmen",
      services: "Leistungen",
      scopeOfWork: "Leistungsumfang",
      priceByArea: "Preis nach Bereich",
      quoteTotal: "Angebotssumme",
      acceptQuote: "Angebot annehmen",
      day: (n) => `Tag ${n}`,
      crewOf: (n) => `Team von ${n}`,
      halfDay: "Halber Tag",
      paintLine: (products, coats) =>
        products && coats ? `Farbe: ${products} · ${coats}` : products ? `Farbe: ${products}` : coats,
      coats: (n) => (n === 1 ? "1 Anstrich" : `${n} Anstriche`),
      viewDocument: "Dokument ansehen →",
      before: "Vorher",
      after: "Nachher",
      recentWork: "Aktuelle Arbeiten",
      documentsHeading: "Nachweise und Dokumente",
      whatClientsSaid: "Das sagen unsere Kunden",
      whatElseWeDo: "Was wir sonst noch tun",
      watchVideo: "Unser Vorstellungsvideo ansehen",
      teamPhotoAlt: "Unser Team",
    },
    // ── /estimate-report/[token] — the instant estimate as a proposal ─────
    // The same presentation as the quote, with the RANGE where the prices
    // would be (app/estimate-report/[token]/ReportView.js).
    rangeProposal: {
      yourEstimate: "Ihre Schätzung",
      estimateWord: "Schätzung",
      estimatedRange: "Geschätzte Spanne",
      subjectToVisit: "Schätzung — vorbehaltlich einer Besichtigung vor Ort",
      rangeFor: (option) => `Für: ${option}`,
      rangeNote: (company) => `Auf Grundlage Ihrer Angaben. ${company} bestätigt den endgültigen Preis nach einer Besichtigung vor Ort — verbindlich wird erst ein Angebot, das Sie annehmen.`,
      noRange: (company) => `${company} bestätigt Ihren Preis nach einer Besichtigung vor Ort.`,
      whatHappensNext: "Wie es weitergeht",
      bookVisit: "Besichtigung buchen",
      talkToUs: "Sprechen Sie mit uns",
    },
    waiverKicker: "Haftungsverzicht",
    waiverAttachedTo: (ref) => `Beigefügt zu ${ref}`,
    waiverIntro: "Bitte lesen Sie jeden Abschnitt und bestätigen Sie per Häkchen, dass Sie ihn verstanden haben. Die Unterschrift folgt am Ende.",
    waiverAcknowledgements: "Bestätigungen",
    waiverSign: "Unterschreiben",
    waiverAcknowledged: (n, total) => `${n} von ${total} bestätigt`,
    signWaiver: "Haftungsverzicht unterschreiben",
    waiverTickRemaining: (n) =>
      n === 1 ? "Setzen Sie das letzte Häkchen, um unterschreiben zu können." : `Setzen Sie die restlichen ${n} Häkchen, um unterschreiben zu können.`,
    waiverConsent: "Ich stimme zu, dass meine Unterschrift hier meine elektronische Unterschrift ist und dass ich diesen Haftungsverzicht gelesen habe und akzeptiere.",
    waiverSignedTitle: "Haftungsverzicht unterschrieben — vielen Dank",
    waiverSignedBody: (company) => `Eine Kopie wurde Ihnen zugesandt und bei ${company} abgelegt.`,
    waiverSignedOn: (date) => `Unterschrieben am ${date}`,
    waiverSignedBy: (name, date) => `Unterschrieben von ${name} am ${date}`,
    waiverAfterNote: "Nach der Unterschrift erhalten Sie eine Kopie mit Datum, Ihrem Namen und jeder Bestätigung; sie wird zu diesem Auftrag abgelegt. Das Angebot wird separat unterschrieben.",
    waiverRequiredBeforeApprove: "Unterschreiben Sie den beigefügten Haftungsverzicht, bevor Sie dieses Angebot annehmen.",
    waiverCopyIntro: (company) => `Ihre unterschriebene Kopie des Haftungsverzichts für ${company} ist beigefügt.`,
    waiverLinkIntro: (company, title) => `${company} hat ein Dokument zum Lesen und Unterschreiben für Sie: „${title}“. Es dauert eine Minute.`,
    waiverOpen: "Lesen und unterschreiben",
    approveThisQuote: "Dieses Angebot annehmen",
    decline: "Ablehnen",
    whatsIncluded: "Was enthalten ist",
    whatCouldChange: "Was diesen Preis ändern könnte",
    termsExplained: "Die Bedingungen dieses Angebots, erklärt",
    optionalExtras: "Optionale Zusatzleistungen",
    extrasTickHint:
      "Haken Sie an, was Sie zusätzlich möchten. Die Gesamtsumme aktualisiert sich dabei laufend — berechnet wird nichts, bevor Sie annehmen.",
    extrasChosen: "Bei der Annahme dieses Angebots ausgewählt.",
    includesOptionalExtras: "Enthält optionale Zusatzleistungen",
    payOfflineHint: "Sie zahlen per E-Transfer oder Scheck statt mit Karte.",
    howTheWorkRuns: "Wie die Arbeiten ablaufen",
    paymentTerms: "Zahlungsbedingungen",
    yourFullName: "Ihr vollständiger Name",
    typeYourName: "Geben Sie Ihren Namen ein",
    signature: "Unterschrift",
    signatureConsent: (total) =>
      `Ich stimme zu, dass meine Unterschrift hier meine elektronische Unterschrift ist und dieses Angebot über ${total} annimmt.`,
    approveConfirm: (total) => `Dieses Angebot über ${total} annehmen?`,
    declineConfirm: "Dieses Angebot ablehnen?",
    approveSubExtras: (extras) =>
      `Einschließlich ${extras} an optionalen Zusatzleistungen. Damit sagen Sie, dass losgelegt werden kann.`,
    approveSubPlain: "Damit sagen Sie, dass losgelegt werden kann.",
    declineSub: "Sie können jederzeit ein überarbeitetes Angebot anfragen.",
    yesApprove: "Ja, annehmen",
    yesDecline: "Ja, ablehnen",
    goBack: "Zurück",
    approvedTitle: "Angenommen — vielen Dank",
    approvedBody: (company) =>
      `${company} wurde benachrichtigt und meldet sich zu den nächsten Schritten.`,
    declinedTitle: "Angebot abgelehnt",
    declinedBody: (company) =>
      `${company} wurde benachrichtigt. Falls das ein Versehen war, rufen Sie dort an.`,
    expiredTitle: "Dieses Angebot ist abgelaufen",
    expiredBody: (company) =>
      `Wenden Sie sich an ${company} für einen aktuellen Preis.`,
    approvedCopyIntro: (company) =>
      `Vielen Dank, dass Sie Ihr Angebot mit ${company} angenommen haben. Eine Kopie liegt für Ihre Unterlagen bei.`,
    measuredAt: (address) => `Vermessen an: ${address}`,
    genericError: "Etwas ist schiefgelaufen. Versuchen Sie es erneut.",
    connectionLost: "Ihr Angebot konnte nicht geladen werden.",
    connectionLostHint:
      "Möglicherweise ist die Verbindung abgebrochen. Prüfen Sie Ihre Verbindung und versuchen Sie es erneut — es wurde nichts gesendet.",
    tryAgain: "Erneut versuchen",
    linkInvalidHint:
      "Wenden Sie sich an das Unternehmen, das es Ihnen geschickt hat; es kann Ihnen einen neuen Link senden.",

    financingAvailable: "Finanzierung",
    financingHeading: "Monatlich zahlen",
    financingMonthly: (monthly) => `Etwa ${monthly} im Monat`,
    financingTermsLine: (months, apr) =>
      `Geschätzt über ${months} Monate bei ${apr} effektivem Jahreszins.`,
    financingEstimateNote: (company) =>
      `Nur eine Schätzung, zu den von ${company} genannten Konditionen und auf Basis der Gesamtsumme oben. Den tatsächlichen Zinssatz, die Rate und die Zusage nennt Ihnen Ihr Finanzierungspartner bei der Antragstellung.`,
    financingCta: "Finanzierungsoptionen ansehen",
    quoteQuestions: (company, phone) =>
      phone
        ? `Fragen? Antworten Sie auf die E-Mail oder rufen Sie ${company} unter ${phone} an.`
        : `Fragen? Antworten Sie auf die E-Mail oder rufen Sie ${company} an.`,

    accountFor: (name) => `Konto von ${name}`,
    balanceOwing: "Offener Saldo",
    nothingOutstanding: "Nichts offen. Vielen Dank.",
    acrossInvoices: (n) => `Verteilt auf ${n} Rechnung${n === 1 ? "" : "en"}.`,
    invoicesHeading: "Rechnungen",
    quotesHeading: "Angebote",
    paidNote: (amount) => `${amount} bezahlt`,
    dueNote: (date) => `fällig ${date}`,
    pay: (amount) => `${amount} bezahlen`,
    paid: "Bezahlt",
    review: "Ansehen",
    // Keyed by the QuoteStatus enum — see the note in the `en` block.
    quoteStatus: {
      draft: "Entwurf",
      sent: "Wartet auf Ihre Antwort",
      accepted: "Angenommen",
      declined: "Abgelehnt",
    },
    paymentReceived:
      "Zahlung erhalten — vielen Dank. Es kann eine Minute dauern, bis sie unten erscheint.",
    payCard: (amount) => `${amount} per Karte zahlen`,
    payBank: (amount) => `${amount} vom Bankkonto zahlen`,
    bankNote: "Eine Bankzahlung braucht 3–5 Werktage bis zur Gutschrift. Bis dahin wird die Rechnung als ausstehend angezeigt.",
    bankPendingBanner: "Bankzahlung eingegangen — die Gutschrift dauert 3–5 Werktage. Danach wird die Rechnung als bezahlt angezeigt.",
    bankPending: "Bankzahlung ausstehend",
    bankFailed: (reason) => `Die Bankzahlung ist fehlgeschlagen${reason ? ` — ${reason}` : ""}. Sie können es erneut versuchen oder per Karte zahlen.`,
    bankOverCap: (max, amount) => `Bankeinzug ist bis ${max} pro Zahlung möglich — diese Rechnung beträgt ${amount}, daher nur per Karte.`,
    paymentNotStarted: (company) => `Diese Zahlung konnte nicht gestartet werden — bitte versuchen Sie es per Karte oder wenden Sie sich an ${company}.`,
    portalQuestions: (company, phone, email) =>
      `Fragen dazu? Wenden Sie sich an ${company}${phone ? ` unter ${phone}` : ""}${email ? ` · ${email}` : ""}.`,

    backToAccount: "Zurück zu Ihrem Konto",
    due: "Fällig",
    wasDue: "War fällig",
    noItemisedBreakdown:
      "Auf dieser Rechnung gibt es keine Einzelaufstellung.",
    paidInFull: "Vollständig bezahlt",
    paidInFullThanks: "Vollständig bezahlt — vielen Dank",
    invoiceNotFound: "Diese Rechnung gehört nicht zu Ihrem Konto.",
    arrangePayment:
      "Bitte melden Sie sich bei uns, um die Zahlung zu vereinbaren.",
    acceptedMethods: (methods) => `Akzeptierte Zahlungsmethoden: ${methods}.`,

    portal: {
      nextVisitKicker: "Nächster Besuch",
      planKicker: "Ihr Plan",
      upcomingHeading: "Kommende Besuche",
      pastHeading: "Vergangene Besuche",
      between: (from, to) => `zwischen ${from} und ${to}`,
      at: (time) => `um ${time}`,
      withCrew: (name) => `mit ${name}`,
      typeVisit: "Besuch",
      typeReturn: "Nachbesuch",
      typeAppointment: "Termin",
      typeCall: "Telefonat",
      typeVideo: "Videoanruf",
      frequency: {
        weekly: "Jede Woche",
        monthly: "Jeden Monat",
        quarterly: "Alle 3 Monate",
        semiannual: "Zweimal im Jahr",
        annual: "Einmal im Jahr",
      },
      perVisit: (amount) => `${amount} pro Besuch`,
      taxIncluded: "inkl. Steuern",
      memberDiscount: (pct) => `Enthält Ihren Planrabatt von ${pct} %`,
      included: "Was enthalten ist",
      nextDates: "Nächste Termine",
      endsOn: (date) => `Der Plan läuft bis ${date}`,
      visitsSold: (n) => (n === 1 ? "1 Besuch in diesem Plan" : `${n} Besuche in diesem Plan`),
      reschedule: "Verschiebung anfragen",
      skip: "Diesen Besuch auslassen",
      rescheduleQuestion: "Was würde Ihnen besser passen?",
      skipQuestion: "Sollen wir etwas wissen? (optional)",
      requestPlaceholder: "Zum Beispiel: jeder Wochentag nach dem 20.",
      requestExplain: (company) => `${company} meldet sich bei Ihnen. Bis zur Bestätigung ändert sich nichts.`,
      requestSend: "Anfrage senden",
      cancel: "Abbrechen",
      requested: "Anfrage gesendet",
      requestTooLate: "Dieser Besuch ist zu nah, um ihn hier zu ändern. Bitte rufen Sie an.",
      requestFailed: "Ihre Anfrage konnte nicht gesendet werden. Bitte erneut versuchen oder anrufen.",
      callToChange: "Weniger als ein Tag entfernt. Zum Ändern bitte anrufen.",
      photoAlt: "Foto von diesem Besuch",
      loginEmailSubject: (company) => `Ihr Konto bei ${company}`,
      loginEmailLabel: "Ihr Konto",
      loginEmailGreeting: (first) => (first ? `Hallo ${first},` : "Hallo,"),
      loginEmailIntro: (company) => `Hier ist der Link zu Ihrem Konto bei ${company}: Ihre Angebote, Rechnungen, Besuche und Pläne an einem Ort.`,
      loginEmailButton: "Ihr Konto öffnen",
      loginEmailKeep: "Dieser Link ist persönlich. Geben Sie ihn nicht weiter und setzen Sie ein Lesezeichen, um jederzeit zurückzukehren.",
      loginEmailIgnore: "Wenn Sie diesen Link nicht angefordert haben, können Sie diese E-Mail ignorieren. An Ihrem Konto hat sich nichts geändert.",
      rescheduleSubject: (what, date) => `${what} am ${date} verschieben`,
      skipSubject: (what, date) => `${what} am ${date} auslassen`,
      requestNoMessage: "Keine Nachricht — bitte schlagen Sie einen anderen Termin vor.",
      maintenanceSubject: (plan) => `Nächsten Besuch buchen — ${plan}`,
      preferredLine: (when) => `Passt mir: ${when}`,
      maintenanceNoNote: "Bitte schlagen Sie einen Termin für meinen nächsten enthaltenen Besuch vor.",
      ticketReplySubject: (subject) => `Re: ${subject}`,
      ticketReplyIntro: (who, subject) => `${who} hat zu „${subject}“ geantwortet:`,
      ticketReplyButton: "Ansehen und antworten",
      ticketEmailLabel: "Ihre Anfrage",
      tickets: {
        heading: "Ihre Anfragen",
        reportIssue: "Problem melden",
        requestWork: "Arbeit anfragen",
        reportOnVisit: "Problem melden",
        reportTitle: "Problem melden",
        aboutVisit: (date) => `Zum Besuch am ${date}`,
        typeLabel: "Worum geht es?",
        types: {
          repair: "Etwas muss repariert werden",
          warranty: "Garantiefall",
          question: "Eine Frage",
          billing: "Abrechnung",
          reschedule: "Termin ändern",
          maintenance: "Wartungsbesuch",
        },
        subjectLabel: "Kurze Zusammenfassung",
        bodyLabel: "Erzählen Sie uns, was los ist",
        photosLabel: "Fotos (optional)",
        addPhoto: "Foto hinzufügen",
        uploading: "Wird hochgeladen…",
        uploadFailed: "Dieses Foto konnte nicht hochgeladen werden.",
        send: "Senden",
        cancel: "Abbrechen",
        sent: (company) => `Gesendet. ${company} antwortet hier und per E-Mail.`,
        failed: "Konnte nicht gesendet werden. Bitte erneut versuchen.",
        status: {
          open: "Eingegangen",
          in_progress: "In Bearbeitung",
          waiting_on_client: "Wartet auf Sie",
          resolved: "Gelöst",
          closed: "Geschlossen",
        },
        you: "Sie",
        replyPlaceholder: "Antwort schreiben…",
        sendReply: "Antwort senden",
        closedNote: "Diese Anfrage ist geschlossen. Melden Sie ein neues Problem, wenn etwas anderes auftritt.",
        workTitle: "Arbeit anfragen",
        workNewJob: "Ein neuer Auftrag oder ein Angebot",
        workMaintenance: "Ein Wartungsbesuch",
        workService: "Welche Leistung?",
        workServiceOther: "Etwas anderes",
        workDescribe: "Beschreiben Sie die Arbeit",
        workDates: "Wunschtermine (optional)",
        workDatesPlaceholder: "Zum Beispiel: ein Wochentag Anfang November",
        workSent: (company) => `Gesendet. ${company} meldet sich zur Bestätigung. Bis dahin wird nichts gebucht oder berechnet.`,
        workPlan: "Welcher Plan?",
        workRemaining: (n) => (n === 1 ? "Noch 1 enthaltener Besuch" : `Noch ${n} enthaltene Besuche`),
        workUntilCancelled: "Besuche laufen bis zum Ende des Plans weiter",
        workWindow: "Wann passt es Ihnen?",
        workWindowPlaceholder: "Zum Beispiel: vormittags, die Woche ab dem 10.",
        workNote: "Sonst noch etwas? (optional)",
        workSetupIntro: (company) => `Sie haben noch keinen Wartungsplan. Sagen Sie ${company}, was regelmäßig betreut werden soll und wie oft, dann erhalten Sie Vorschläge.`,
        workSetupDescribe: "Was soll betreut werden, und wie oft?",
        workConfirmNote: (company) => `${company} bestätigt alles, bevor gebucht wird. Von hier aus wird nichts geplant oder berechnet.`,
      },
    },

    job: {
      kicker: "Ihr Auftrag",
      dayOf: (day, total) => `Tag ${day} von ${total}`,
      onSchedule: "im Zeitplan",
      runningLate: "im Verzug",
      finished: "Abgeschlossen",
      started: (date) => `Begonnen am ${date}`,
      finishPlanned: (date) => `Fertigstellung geplant am ${date}`,
      datesToConfirm: "Termine werden noch bestätigt",
      done: "Erledigt",
      inProgress: "In Arbeit",
      waitingOn: "Wartet auf",
      upNext: "Als Nächstes",
      photos: (n) => (n === 1 ? "1 Foto" : `${n} Fotos`),
      onSiteSince: (names, time) => `${names} seit ${time} vor Ort`,
      photoAdded: (time) => `Foto hinzugefügt um ${time}`,
      today: "Heute",
      waitingOnStep: (title) => `Wartet auf: ${title}`,
      waitingOnExternal: (reason) => `Wartet auf: ${reason}`,
      waitingOnApproval: (label) => `Wartet auf Ihre Freigabe des Nachtrags ${label}`,
      waitingOnYou: "Wartet auf Sie",
      reviewAndSign: "Prüfen und unterschreiben",
      datesNote: "Die Termine sind der Plan des Teams und können sich verschieben.",
      changesHeading: "Änderungen, die auf Ihre Freigabe warten",
      approvedChange: (label, date) => `${label} freigegeben am ${date}`,
      stepsDone: (done, total) => `${done} von ${total} Schritten erledigt`,
    },

    changeOrder: {
      kicker: "Nachtrag",
      toQuote: (number) => `zum Angebot ${number}`,
      forClient: (name) => `Für ${name}`,
      originalLine: "Ursprüngliche Position",
      theChange: "Die Änderung",
      photo: (when) => `Foto · ${when}`,
      quoteTotalAsApproved: (date) => (date ? `Angebotssumme, freigegeben am ${date}` : "Freigegebene Angebotssumme"),
      priorChanges: "Bereits freigegebene Änderungen",
      thisChange: "Diese Änderung",
      taxOnChange: (rate) => `${rate} Steuer auf die Änderung`,
      taxUnknown: "Die Steuer auf diese Änderung wird hier nicht gezeigt; Ihre Rechnung weist sie zum Satz des Angebots aus.",
      newTotal: "Neue Summe",
      schedule: "Zeitplan",
      finishMoves: (from, to, days) => `Die Fertigstellung verschiebt sich vom ${from} auf den ${to} (${days})`,
      finishMovesBy: (days) => `Die Fertigstellung verschiebt sich um ${days}`,
      days: (n) => (n === 1 || n === -1 ? `${n > 0 ? "+" : "−"}1 Tag` : `${n > 0 ? "+" : "−"}${Math.abs(n)} Tage`),
      scheduleUnchanged: "Keine Änderung am Zeitplan",
      consent: (amount, total) => `Ich gebe diese Änderung über ${amount} inklusive Steuer frei; die neue Summe beträgt damit ${total}.`,
      consentSchedule: (days) => ` Ich stimme auch der Änderung des Zeitplans zu (${days}).`,
      approveAndSign: "Freigeben und unterschreiben",
      askQuestion: "Eine Frage stellen",
      footer: (company, phone) => `Das von Ihnen unterschriebene Angebot bleibt unverändert; dieser Nachtrag wird ihm hinzugefügt. Fragen? Antworten Sie auf die SMS oder rufen Sie ${company}${phone ? ` unter ${phone}` : ""} an.`,
      approvedTitle: "Freigegeben — vielen Dank",
      approvedBody: (company) => `${company} hat Ihre unterschriebene Freigabe und setzt die Änderung um.`,
      approvedOn: (date) => `Freigegeben am ${date}.`,
      withdrawnTitle: "Diese Änderung wurde zurückgezogen",
      withdrawnBody: (company) => `${company} hat diesen Nachtrag zurückgezogen. An Ihrem Angebot ändert sich nichts.`,
      notFound: "Dieser Link ist ungültig.",
      notFoundBody: "Wenden Sie sich an das Unternehmen, mit dem Sie arbeiten; es kann Ihnen einen neuen schicken.",
      signFailed: "Ihre Freigabe konnte gerade nicht gespeichert werden. Versuchen Sie es gleich noch einmal.",
      emailSubject: (label, company) => `${label} von ${company} — bitte prüfen und unterschreiben`,
      emailIntro: (name, label, number) => `Hallo ${name}, es gibt eine Änderung an Ihrem Auftrag (${label}${number ? `, Angebot ${number}` : ""}), die Ihre Freigabe braucht, bevor die Arbeit weitergeht.`,
      emailButton: "Prüfen und unterschreiben",
      emailFooter: "An Ihrem Angebot und Ihrer Rechnung ändert sich nichts, bis Sie unterschreiben.",
      smsText: (company, label, url) => `${company}: Der Nachtrag ${label} zu Ihrem Auftrag braucht Ihre Freigabe — hier prüfen und unterschreiben: ${url}`,
    },

    selfQuote: {
      documentWord: "Anfrage",
      eyebrow: "Angebot anfragen",
      languageLabel: "Sprache",

      step1Title: "Womit können wir helfen?",
      step1Hint:
        "Wählen Sie, was am ehesten passt — die Einzelheiten klären wir.",
      noServices: (phone) =>
        `Dieses Unternehmen hat seine Leistungen noch nicht eingerichtet. Wenden Sie sich direkt an das Unternehmen${phone ? ` unter ${phone}` : ""}.`,

      step2Hint: "Ungefähre Zahlen genügen — nichts hiervon ist verbindlich.",
      designKitchen: "Lieber selbst zeichnen? Gestalten Sie Ihre Küche selbst und schicken Sie uns den Grundriss →",
      timelineLabel: "Wann möchten Sie beginnen?",
      timelineAsap: "So bald wie möglich",
      timeline2Weeks: "Innerhalb von 2 Wochen",
      timeline1To3Months: "In den nächsten 1–3 Monaten",
      timelineExploring: "Ich informiere mich vorerst nur",
      budgetLabel: "Ungefähres Budget?",
      optional: "(optional)",
      budgetUnder: (s) => `Unter ${s}1.000`,
      budgetLow: (s) => `${s}1.000 – ${s}5.000`,
      budgetMid: (s) => `${s}5.000 – ${s}15.000`,
      budgetHigh: (s) => `${s}15.000 und mehr`,
      budgetUnsure: "Noch nicht sicher",
      notesLabel: "Sollten wir sonst noch etwas wissen?",
      notesPlaceholder: "Fotos, Termine, Zugang, alles Ungewöhnliche…",
      continueCta: "Weiter",

      step3Title: "Wohin sollen wir es schicken?",
      step3Hint: "E-Mail oder Telefon genügt.",
      namePlaceholder: "Ihr Name",
      emailPlaceholder: "E-Mail",
      phonePlaceholder: "Telefon",
      addressPlaceholder: "Wo sind die Arbeiten?",
      errAddress: "Bitte nennen Sie die Adresse der Arbeiten.",

      uploadLabel: "Fotos, ein Video oder einen PDF-Plan hinzufügen",
      uploadHint:
        "Ein Foto, ein kurzes Video oder Ihr PDF-Plan hilft uns, genau zu kalkulieren.",
      uploadDocumentFallback: "PDF-Plan",
      uploadBusy: "Wird hochgeladen…",
      uploadLimit: (n) => `Sie können bis zu ${n} Dateien anhängen.`,
      uploadFailed:
        "Hochladen fehlgeschlagen — prüfen Sie Ihre Verbindung und versuchen Sie es erneut.",
      uploadRejected: "Diese Datei konnte nicht hochgeladen werden.",
      uploadTooLarge: (size, limit) => `Diese Datei ist ${size} groß — pro Upload sind höchstens ${limit} möglich. Machen Sie das Foto in kleinerer Größe, oder verkleinern Sie es und versuchen Sie es erneut.`,
      uploadRemove: "Entfernen",
      back: "Zurück",
      sendCta: "Meine Anfrage senden",
      noObligation: (company) =>
        `Unverbindlich. ${company} meldet sich mit einem Preis bei Ihnen.`,

      errName: "Bitte nennen Sie uns Ihren Namen.",
      errContact:
        "Geben Sie eine E-Mail-Adresse oder eine Telefonnummer an, damit wir antworten können.",
      errSend: "Ihre Anfrage konnte nicht gesendet werden.",
      linkInvalid: "Dieser Link ist nicht gültig.",
      linkInvalidHint:
        "Prüfen Sie den Link oder wenden Sie sich direkt an das Unternehmen.",

      confirmTitle: "Anfrage erhalten",
      confirmIntro: (company) =>
        `${company} hat alles Untenstehende und meldet sich mit einem Preis.`,
      requestedHeading: "Wonach Sie gefragt haben",
      nextHeading: "Wie es weitergeht",
      next1Title: "Sie lesen es",
      next1Body:
        "Ihre Antworten gehen sofort beim Unternehmen ein, zusammen mit allem, was Sie angehängt haben.",
      next2Title: "Sie kalkulieren den Preis",
      next2Body:
        "Ein Mensch ermittelt die tatsächlichen Kosten für Ihren Auftrag — hier wurde nichts automatisch berechnet.",
      next3Title: "Sie erhalten ein Angebot",
      next3Body:
        "Es kommt als Dokument, das Sie lesen, hinterfragen und annehmen können. Bis dahin ist nichts vereinbart.",
      estimateLabel: "Geschätzter Rahmen",
      beforeTax: "vor Steuern",
      gatedNote:
        "Es wird noch kein Preis angezeigt — diese Anfrage wurde noch nicht kalkuliert. Das ist Absicht: Die Zahl, die Sie bekommen, ist eine, für die ein Mensch geradesteht.",
      submittedLabel: "Gesendet",
      copySentTo: (email) => `Eine Kopie ist auf dem Weg an ${email}.`,
      callInstead: "Brauchen Sie es schneller?",
      // The in-person visit offered under the confirmation. Only rendered when
      // the company can actually take a booking — see lib/booking/canBookVisit.js.
      bookVisitTitle: "Sollen wir vorbeikommen und es uns ansehen?",
      bookVisitBody:
        "Vereinbaren Sie einen Termin vor Ort, und wir bestätigen Ihren Preis direkt bei Ihnen.",
      bookVisitCta: "Termin vereinbaren",

      emailSubject: (company) => `Ihre Anfrage an ${company}`,
      emailIntro: (company) =>
        `Vielen Dank — ${company} hat Ihre Anfrage. Hier ist, was Sie gesendet haben, für Ihre Unterlagen.`,
    },

    visit: {
      eyebrow: "Ihr Termin",
      loadFailed: "Wir konnten Ihren Termin nicht laden.",
      loadFailedHint:
        "Prüfen Sie den Link in Ihrer E-Mail oder wenden Sie sich direkt an das Unternehmen.",

      aboutEstimate: (number) => `Zu Ihrem Angebot ${number}`,

      whenLabel: "Wann",
      whereLabel: "Wo",
      modeVisit: "Wir kommen zu Ihnen",
      modeCall: "Telefonat — wir rufen Sie an",
      modeVideo: "Videocall — wir schicken Ihnen einen Link per E-Mail",
      addressUnknown: "Adresse wird noch bestätigt",
      depositPaid: (amount) => `Anzahlung von ${amount} bezahlt`,

      changeHeading: "Möchten Sie etwas ändern?",
      rescheduleCta: "Zeit ändern",
      cancelCta: "Diesen Termin absagen",

      cannotCancelled: "Dieser Termin wurde bereits abgesagt.",
      cannotHappened: "Dieser Termin hat bereits stattgefunden.",
      cannotAwaitingPayment:
        "Dieser Termin ist noch nicht bestätigt — die Zahlung ist nicht eingegangen.",
      cannotNotFound: "Zu diesem Link gibt es keinen Termin.",
      cannotTooLate: (notice, company) =>
        `${company} bittet um mindestens ${notice} Vorlauf, deshalb lässt sich dieser Termin hier nicht mehr ändern.`,
      cannotTooLateNoNotice: (company) =>
        `Ihr Termin ist jetzt zu nah, als dass ${company} eine Änderung hier noch annehmen könnte.`,
      noticeHours: (n) => (n === 1 ? "1 Stunde" : `${n} Stunden`),
      callInstead: (company, phone) =>
        phone
          ? `Rufen Sie ${company} unter ${phone} an — dort kann man ihn noch für Sie verschieben.`
          : `Wenden Sie sich an ${company} — dort kann man ihn noch für Sie verschieben.`,

      refundYes: (amount) =>
        `Ihre Anzahlung von ${amount} wird auf die verwendete Karte zurückgebucht.`,
      refundNo: (amount) =>
        `Ihre Anzahlung von ${amount} wird nicht automatisch erstattet — wenden Sie sich deswegen an das Unternehmen.`,
      refundAlready: (amount) =>
        `Ihre Anzahlung von ${amount} wurde bereits erstattet.`,

      cancelConfirmTitle: "Diesen Termin absagen?",
      cancelConfirmBody: (company) =>
        `${company} wird sofort informiert, und Ihre Zeit wird im Kalender wieder frei.`,
      yesCancel: "Ja, absagen",
      keepIt: "Termin behalten",
      cancelledTitle: "Termin abgesagt",
      cancelledBody: (company) =>
        `${company} wurde informiert. Falls das ein Versehen war, melden Sie sich — man findet dort einen neuen Termin für Sie.`,
      cancelledRefunded: (amount) =>
        `Ihre Anzahlung von ${amount} ist auf dem Rückweg. Es kann einige Tage dauern, bis sie auf Ihrem Kontoauszug erscheint.`,

      rescheduleTitle: "Neue Zeit wählen",
      rescheduleKeep: "Meine bisherige Zeit behalten",
      findingTimes: "Termine werden gesucht…",
      timesFailed: "Wir konnten die freien Zeiten gerade nicht laden.",
      pickADay: "Wählen Sie einen Tag, um die Zeiten zu sehen.",
      morning: "Vormittag",
      afternoon: "Nachmittag",
      evening: "Abend",
      nothingThisMonth: "Diesen Monat ist nichts frei.",
      tryNextMonth: "Nächsten Monat versuchen",
      prevMonth: "Voriger Monat",
      nextMonth: "Nächster Monat",
      confirmNewTime: "Meinen Termin hierher verschieben",
      movedTitle: "Ihr Termin wurde verschoben",
      movedBody: (company) =>
        `${company} wurde informiert, und eine neue Bestätigung ist auf dem Weg zu Ihnen.`,

      questions: (company, phone) =>
        phone
          ? `Fragen? Rufen Sie ${company} unter ${phone} an.`
          : `Fragen? Wenden Sie sich an ${company}.`,

      slotTaken: "Diese Zeit wurde gerade vergeben. Wählen Sie eine andere.",
      tooSoon: "Diese Zeit lässt zu wenig Vorlauf. Wählen Sie eine spätere.",
      refundFailed:
        "Wir konnten Ihre Anzahlung gerade nicht erstatten, deshalb wurde nichts abgesagt. Versuchen Sie es gleich noch einmal oder melden Sie sich.",
    },
  },

  // ── Italian, formal ───────────────────────────────────────────────────────
  //
  // `Lei` throughout in the prose, matching the Italian app catalogue.
  //
  // Buttons and confirmations are INFINITIVES ("Approvare questo preventivo",
  // "Sì, annullare"), which is what fr and es already do above. Italian could
  // use an imperative instead, but that forces a tu/Lei choice on every button
  // and a "Paga ora" to a stranger reads as over-familiar on a document that
  // carries the contractor's name. The infinitive is register-neutral.
  //
  // "Appuntamento", not "visita", for the same reason German says "Termin":
  // the record also covers a phone call and a video call.
  it: {
    // "See the property" on /q/[token] — app/components/StreetViewPeek.js.
    streetView: { see: "Vedi la proprietà", hide: "Nascondi", openInMaps: "Apri in Google Maps", frameTitle: "Street View della proprietà" },
    portalDocumentsHeading: "Documenti",

    proposal: {
      contents: "Contenuti",
      yourProject: "Il tuo progetto",
      aboutUs: "Chi siamo",
      beforeAfter: "Prima e dopo",
      importantDocuments: "Documenti importanti",
      testimonials: "Testimonianze",
      services: "Servizi",
      scopeOfWork: "Ambito dei lavori",
      priceByArea: "Prezzo per area",
      quoteTotal: "Totale del preventivo",
      acceptQuote: "Accetta il preventivo",
      day: (n) => `Giorno ${n}`,
      crewOf: (n) => `Squadra di ${n}`,
      halfDay: "Mezza giornata",
      paintLine: (products, coats) =>
        products && coats ? `Pittura: ${products} · ${coats}` : products ? `Pittura: ${products}` : coats,
      coats: (n) => (n === 1 ? "1 mano" : `${n} mani`),
      viewDocument: "Vedi il documento →",
      before: "Prima",
      after: "Dopo",
      recentWork: "Lavori recenti",
      documentsHeading: "Certificati e documenti",
      whatClientsSaid: "Cosa dicono i clienti",
      whatElseWeDo: "Cos'altro facciamo",
      watchVideo: "Guarda il nostro video di presentazione",
      teamPhotoAlt: "Il nostro team",
    },
    // ── /estimate-report/[token] — the instant estimate as a proposal ─────
    // The same presentation as the quote, with the RANGE where the prices
    // would be (app/estimate-report/[token]/ReportView.js).
    rangeProposal: {
      yourEstimate: "La tua stima",
      estimateWord: "Stima",
      estimatedRange: "Fascia stimata",
      subjectToVisit: "Stima — soggetta a sopralluogo",
      rangeFor: (option) => `Per: ${option}`,
      rangeNote: (company) => `In base ai dati che ci hai fornito. ${company} conferma il prezzo finale dopo aver visto il lavoro di persona — nulla è vincolante finché non approvi un preventivo.`,
      noRange: (company) => `${company} confermerà il tuo prezzo dopo un sopralluogo.`,
      whatHappensNext: "Cosa succede ora",
      bookVisit: "Prenota il sopralluogo",
      talkToUs: "Parla con noi",
    },
    waiverKicker: "Liberatoria",
    waiverAttachedTo: (ref) => `Allegata a ${ref}`,
    waiverIntro: "Leggi ogni sezione e spunta di averla compresa. La firma è alla fine.",
    waiverAcknowledgements: "Dichiarazioni",
    waiverSign: "Firma",
    waiverAcknowledged: (n, total) => `${n} di ${total} confermate`,
    signWaiver: "Firma la liberatoria",
    waiverTickRemaining: (n) =>
      n === 1 ? "Spunta la dichiarazione rimanente per poter firmare." : `Spunta le ${n} dichiarazioni rimanenti per poter firmare.`,
    waiverConsent: "Accetto che la firma qui costituisca la mia firma elettronica e di aver letto e accettato questa liberatoria.",
    waiverSignedTitle: "Liberatoria firmata — grazie",
    waiverSignedBody: (company) => `Una copia ti è stata inviata e archiviata presso ${company}.`,
    waiverSignedOn: (date) => `Firmata il ${date}`,
    waiverSignedBy: (name, date) => `Firmata da ${name} il ${date}`,
    waiverAfterNote: "Una volta firmata, una copia con la data, il tuo nome e ogni dichiarazione ti viene inviata e archiviata in questo lavoro. Il preventivo si firma separatamente.",
    waiverRequiredBeforeApprove: "Firma la liberatoria allegata prima di approvare questo preventivo.",
    waiverCopyIntro: (company) => `In allegato la tua copia firmata della liberatoria per ${company}.`,
    waiverLinkIntro: (company, title) => `${company} ha un documento da leggere e firmare: «${title}». Ci vuole un minuto.`,
    waiverOpen: "Leggi e firma",
    approveThisQuote: "Approvare questo preventivo",
    decline: "Rifiutare",
    whatsIncluded: "Che cosa è compreso",
    whatCouldChange: "Che cosa potrebbe cambiare questo prezzo",
    termsExplained: "Le condizioni di questo preventivo, spiegate",
    optionalExtras: "Extra facoltativi",
    extrasTickHint:
      "Spunti quello che desidera aggiungere. Il totale si aggiorna man mano — non viene addebitato nulla finché non approva.",
    extrasChosen: "Scelto al momento dell'approvazione di questo preventivo.",
    includesOptionalExtras: "Comprende extra facoltativi",
    payOfflineHint: "Pagherai con e-transfer o assegno invece che con carta.",
    howTheWorkRuns: "Come si svolgono i lavori",
    paymentTerms: "Condizioni di pagamento",
    yourFullName: "Il suo nome e cognome",
    typeYourName: "Scriva il suo nome",
    signature: "Firma",
    signatureConsent: (total) =>
      `Accetto che la firma apposta qui sia la mia firma elettronica e approvi questo preventivo per ${total}.`,
    approveConfirm: (total) => `Approvare questo preventivo per ${total}?`,
    declineConfirm: "Rifiutare questo preventivo?",
    approveSubExtras: (extras) =>
      `Compresi ${extras} di extra facoltativi. Così sanno che possono procedere.`,
    approveSubPlain: "Così sanno che possono procedere.",
    declineSub: "Può sempre chiedere un preventivo rivisto.",
    yesApprove: "Sì, approvare",
    yesDecline: "Sì, rifiutare",
    goBack: "Indietro",
    approvedTitle: "Approvato — grazie",
    approvedBody: (company) =>
      `${company} è stata avvisata e la contatterà per i passi successivi.`,
    declinedTitle: "Preventivo rifiutato",
    declinedBody: (company) =>
      `${company} è stata avvisata. Se è stato un errore, li chiami.`,
    expiredTitle: "Questo preventivo è scaduto",
    expiredBody: (company) =>
      `Contatti ${company} per un prezzo aggiornato.`,
    approvedCopyIntro: (company) =>
      `Grazie per aver approvato il suo preventivo con ${company}. In allegato una copia per i suoi archivi.`,
    measuredAt: (address) => `Misurato all'indirizzo: ${address}`,
    genericError: "Qualcosa è andato storto. Riprovi.",
    connectionLost: "Non è stato possibile caricare il suo preventivo.",
    connectionLostHint:
      "Potrebbe aver perso il segnale. Controlli la connessione e riprovi — non è stato inviato nulla.",
    tryAgain: "Riprova",
    linkInvalidHint:
      "Contatti l'azienda che glielo ha inviato: potrà mandarle un nuovo link.",

    financingAvailable: "Finanziamento",
    financingHeading: "Pagare a rate",
    financingMonthly: (monthly) => `Circa ${monthly} al mese`,
    financingTermsLine: (months, apr) =>
      `Stimato su ${months} mesi con un TAEG del ${apr}.`,
    financingEstimateNote: (company) =>
      `È solo una stima, alle condizioni indicate da ${company} e sul totale qui sopra. Il tasso, la rata e l'approvazione effettivi glieli conferma il suo istituto di finanziamento al momento della domanda.`,
    financingCta: "Vedere le opzioni di finanziamento",
    quoteQuestions: (company, phone) =>
      phone
        ? `Domande? Risponda all'email, oppure chiami ${company} al ${phone}.`
        : `Domande? Risponda all'email, oppure chiami ${company}.`,

    accountFor: (name) => `Conto di ${name}`,
    balanceOwing: "Saldo da pagare",
    nothingOutstanding: "Nulla in sospeso. Grazie.",
    acrossInvoices: (n) => `Su ${n} ${n === 1 ? "fattura" : "fatture"}.`,
    invoicesHeading: "Fatture",
    quotesHeading: "Preventivi",
    paidNote: (amount) => `${amount} pagati`,
    dueNote: (date) => `scadenza ${date}`,
    pay: (amount) => `Pagare ${amount}`,
    paid: "Pagata",
    review: "Consultare",
    // Keyed by the QuoteStatus enum — see the note in the `en` block.
    quoteStatus: {
      draft: "Bozza",
      sent: "In attesa della sua risposta",
      accepted: "Approvato",
      declined: "Rifiutato",
    },
    paymentReceived:
      "Pagamento ricevuto — grazie. Può volerci un minuto prima che compaia qui sotto.",
    payCard: (amount) => `Paga ${amount} con carta`,
    payBank: (amount) => `Paga ${amount} dal conto bancario`,
    bankNote: "Un pagamento bancario richiede 3–5 giorni lavorativi per essere accreditato. Fino ad allora la fattura risulta in attesa.",
    bankPendingBanner: "Pagamento bancario ricevuto — servono 3–5 giorni lavorativi per l'accredito. Poi la fattura risulterà pagata.",
    bankPending: "Pagamento bancario in attesa",
    bankFailed: (reason) => `Il pagamento bancario non è riuscito${reason ? ` — ${reason}` : ""}. Può riprovare o pagare con carta.`,
    bankOverCap: (max, amount) => `L'addebito bancario è disponibile fino a ${max} per pagamento — questa fattura è di ${amount}, quindi solo con carta.`,
    paymentNotStarted: (company) => `Non è stato possibile avviare questo pagamento — provi con la carta o contatti ${company}.`,
    portalQuestions: (company, phone, email) =>
      `Domande su tutto questo? Contatti ${company}${phone ? ` al ${phone}` : ""}${email ? ` · ${email}` : ""}.`,

    backToAccount: "Tornare al suo conto",
    due: "Scadenza",
    wasDue: "Scaduta il",
    noItemisedBreakdown: "Nessun dettaglio delle voci su questa fattura.",
    paidInFull: "Saldata per intero",
    paidInFullThanks: "Saldata per intero — grazie",
    invoiceNotFound: "Quella fattura non è nel suo conto.",
    arrangePayment: "La preghiamo di contattarci per concordare il pagamento.",
    acceptedMethods: (methods) => `Metodi di pagamento accettati: ${methods}.`,

    portal: {
      nextVisitKicker: "Prossima visita",
      planKicker: "Il suo piano",
      upcomingHeading: "Visite in programma",
      pastHeading: "Visite passate",
      between: (from, to) => `tra le ${from} e le ${to}`,
      at: (time) => `alle ${time}`,
      withCrew: (name) => `con ${name}`,
      typeVisit: "Visita",
      typeReturn: "Visita di ritorno",
      typeAppointment: "Appuntamento",
      typeCall: "Telefonata",
      typeVideo: "Videochiamata",
      frequency: {
        weekly: "Ogni settimana",
        monthly: "Ogni mese",
        quarterly: "Ogni 3 mesi",
        semiannual: "Due volte l'anno",
        annual: "Una volta l'anno",
      },
      perVisit: (amount) => `${amount} a visita`,
      taxIncluded: "tasse incluse",
      memberDiscount: (pct) => `Include il suo sconto del piano del ${pct}%`,
      included: "Cosa è incluso",
      nextDates: "Prossime date",
      endsOn: (date) => `Il piano dura fino al ${date}`,
      visitsSold: (n) => (n === 1 ? "1 visita in questo piano" : `${n} visite in questo piano`),
      reschedule: "Chiedi di spostare",
      skip: "Salta questa visita",
      rescheduleQuestion: "Cosa le andrebbe meglio?",
      skipQuestion: "C'è qualcosa che dovremmo sapere? (facoltativo)",
      requestPlaceholder: "Per esempio: qualsiasi giorno feriale dopo il 20",
      requestExplain: (company) => `${company} le risponderà. Nulla cambia finché non confermano.`,
      requestSend: "Invia richiesta",
      cancel: "Annulla",
      requested: "Richiesta inviata",
      requestTooLate: "Questa visita è troppo vicina per modificarla qui. La preghiamo di telefonare.",
      requestFailed: "Non è stato possibile inviare la richiesta. Riprovi o telefoni.",
      callToChange: "Manca meno di un giorno. Telefoni per modificarla.",
      photoAlt: "Foto di questa visita",
      loginEmailSubject: (company) => `Il suo account con ${company}`,
      loginEmailLabel: "Il suo account",
      loginEmailGreeting: (first) => (first ? `Buongiorno ${first},` : "Buongiorno,"),
      loginEmailIntro: (company) => `Ecco il link al suo account con ${company}: preventivi, fatture, visite e piani in un unico posto.`,
      loginEmailButton: "Apri il suo account",
      loginEmailKeep: "Questo link è personale. Non lo condivida e lo salvi nei preferiti per tornare quando vuole.",
      loginEmailIgnore: "Se non ha richiesto questo link, può ignorare questa email. Nel suo account non è cambiato nulla.",
      rescheduleSubject: (what, date) => `Spostare ${what} del ${date}`,
      skipSubject: (what, date) => `Saltare ${what} del ${date}`,
      requestNoMessage: "Nessun messaggio — per favore proponete un'altra data.",
      maintenanceSubject: (plan) => `Prenotare la prossima visita — ${plan}`,
      preferredLine: (when) => `Mi va bene: ${when}`,
      maintenanceNoNote: "Per favore proponete una data per la mia prossima visita inclusa.",
      ticketReplySubject: (subject) => `Re: ${subject}`,
      ticketReplyIntro: (who, subject) => `${who} ha risposto su «${subject}»:`,
      ticketReplyButton: "Vedi e rispondi",
      ticketEmailLabel: "La sua richiesta",
      tickets: {
        heading: "Le sue richieste",
        reportIssue: "Segnala un problema",
        requestWork: "Richiedi un lavoro",
        reportOnVisit: "Segnala un problema",
        reportTitle: "Segnala un problema",
        aboutVisit: (date) => `Sulla visita del ${date}`,
        typeLabel: "Di cosa si tratta?",
        types: {
          repair: "Qualcosa da riparare",
          warranty: "Richiesta in garanzia",
          question: "Una domanda",
          billing: "Fatturazione",
          reschedule: "Cambiare una data",
          maintenance: "Visita di manutenzione",
        },
        subjectLabel: "Breve riepilogo",
        bodyLabel: "Ci racconti cosa succede",
        photosLabel: "Foto (facoltative)",
        addPhoto: "Aggiungi una foto",
        uploading: "Caricamento…",
        uploadFailed: "Non è stato possibile caricare quella foto.",
        send: "Invia",
        cancel: "Annulla",
        sent: (company) => `Inviato. ${company} risponderà qui e via email.`,
        failed: "Invio non riuscito. Riprovi.",
        status: {
          open: "Ricevuta",
          in_progress: "In corso",
          waiting_on_client: "In attesa di lei",
          resolved: "Risolta",
          closed: "Chiusa",
        },
        you: "Lei",
        replyPlaceholder: "Scriva una risposta…",
        sendReply: "Invia risposta",
        closedNote: "Questa richiesta è chiusa. Segnali un nuovo problema se succede altro.",
        workTitle: "Richiedi un lavoro",
        workNewJob: "Un nuovo lavoro o preventivo",
        workMaintenance: "Una visita di manutenzione",
        workService: "Quale servizio?",
        workServiceOther: "Altro",
        workDescribe: "Descriva il lavoro",
        workDates: "Date preferite (facoltative)",
        workDatesPlaceholder: "Per esempio: un giorno feriale a inizio novembre",
        workSent: (company) => `Inviato. ${company} la ricontatterà per confermare. Nulla viene prenotato o addebitato prima.`,
        workPlan: "Quale piano?",
        workRemaining: (n) => (n === 1 ? "Resta 1 visita inclusa" : `Restano ${n} visite incluse`),
        workUntilCancelled: "Le visite continuano fino alla fine del piano",
        workWindow: "Quando le va bene?",
        workWindowPlaceholder: "Per esempio: la mattina, la settimana del 10",
        workNote: "Altro? (facoltativo)",
        workSetupIntro: (company) => `Non ha ancora un piano di manutenzione. Dica a ${company} cosa vorrebbe far curare regolarmente e con che frequenza, e le proporranno delle opzioni.`,
        workSetupDescribe: "Cosa va curato, e con che frequenza?",
        workConfirmNote: (company) => `${company} conferma tutto prima di prenotare. Da qui non viene programmato né addebitato nulla.`,
      },
    },

    job: {
      kicker: "Il tuo lavoro",
      dayOf: (day, total) => `Giorno ${day} di ${total}`,
      onSchedule: "nei tempi",
      runningLate: "in ritardo",
      finished: "Terminato",
      started: (date) => `Iniziato il ${date}`,
      finishPlanned: (date) => `Fine prevista il ${date}`,
      datesToConfirm: "Date da confermare",
      done: "Fatto",
      inProgress: "In corso",
      waitingOn: "In attesa di",
      upNext: "A seguire",
      photos: (n) => (n === 1 ? "1 foto" : `${n} foto`),
      onSiteSince: (names, time) => `${names} in cantiere dalle ${time}`,
      photoAdded: (time) => `Foto aggiunta alle ${time}`,
      today: "Oggi",
      waitingOnStep: (title) => `In attesa di: ${title}`,
      waitingOnExternal: (reason) => `In attesa di: ${reason}`,
      waitingOnApproval: (label) => `In attesa della tua approvazione della variante ${label}`,
      waitingOnYou: "Tocca a te",
      reviewAndSign: "Rivedi e firma",
      datesNote: "Le date sono il piano della squadra e possono cambiare.",
      changesHeading: "Modifiche in attesa della tua approvazione",
      approvedChange: (label, date) => `${label} approvata il ${date}`,
      stepsDone: (done, total) => `${done} passaggi su ${total} completati`,
    },

    changeOrder: {
      kicker: "Variante",
      toQuote: (number) => `al preventivo ${number}`,
      forClient: (name) => `Per ${name}`,
      originalLine: "Voce originale",
      theChange: "La modifica",
      photo: (when) => `Foto · ${when}`,
      quoteTotalAsApproved: (date) => (date ? `Totale del preventivo approvato il ${date}` : "Totale del preventivo approvato"),
      priorChanges: "Modifiche già approvate",
      thisChange: "Questa modifica",
      taxOnChange: (rate) => `Imposta del ${rate} sulla modifica`,
      taxUnknown: "L'imposta su questa modifica non è mostrata qui; la fattura la indicherà all'aliquota del preventivo.",
      newTotal: "Nuovo totale",
      schedule: "Tempistica",
      finishMoves: (from, to, days) => `La fine passa dal ${from} al ${to} (${days})`,
      finishMovesBy: (days) => `La fine si sposta di ${days}`,
      days: (n) => (n === 1 || n === -1 ? `${n > 0 ? "+" : "−"}1 giorno` : `${n > 0 ? "+" : "−"}${Math.abs(n)} giorni`),
      scheduleUnchanged: "Nessuna modifica alla tempistica",
      consent: (amount, total) => `Approvo questa modifica per ${amount} imposte incluse, portando il nuovo totale a ${total}.`,
      consentSchedule: (days) => ` Approvo anche la modifica della tempistica (${days}).`,
      approveAndSign: "Approva e firma",
      askQuestion: "Fai una domanda",
      footer: (company, phone) => `Il preventivo originale che hai firmato non cambia; questa appendice vi si aggiunge. Domande? Rispondi al messaggio o chiama ${company}${phone ? ` al ${phone}` : ""}.`,
      approvedTitle: "Approvato — grazie",
      approvedBody: (company) => `${company} ha la tua approvazione firmata e procederà con la modifica.`,
      approvedOn: (date) => `Approvato il ${date}.`,
      withdrawnTitle: "Questa modifica è stata ritirata",
      withdrawnBody: (company) => `${company} ha ritirato questa variante. Nulla cambia nel tuo preventivo.`,
      notFound: "Questo link non è valido.",
      notFoundBody: "Contatta l'azienda con cui stai lavorando: potrà inviartene uno nuovo.",
      signFailed: "Non è stato possibile registrare la tua approvazione. Riprova tra un momento.",
      emailSubject: (label, company) => `${label} da ${company} — da rivedere e firmare`,
      emailIntro: (name, label, number) => `Ciao ${name}, c'è una modifica al tuo lavoro (${label}${number ? `, preventivo ${number}` : ""}) che richiede la tua approvazione prima di proseguire.`,
      emailButton: "Rivedi e firma",
      emailFooter: "Nulla cambia nel tuo preventivo o nella tua fattura finché non firmi.",
      smsText: (company, label, url) => `${company}: la variante ${label} per il tuo lavoro richiede la tua approvazione — rivedi e firma qui: ${url}`,
    },

    selfQuote: {
      documentWord: "Richiesta",
      eyebrow: "Richiedere un preventivo",
      languageLabel: "Lingua",

      step1Title: "Come possiamo aiutarla?",
      step1Hint: "Scelga l'opzione più vicina — ai dettagli pensiamo noi.",
      noServices: (phone) =>
        `Questa impresa non ha ancora configurato i suoi servizi. La contatti direttamente${phone ? ` al ${phone}` : ""}.`,

      step2Hint: "Bastano cifre approssimative — qui nulla è vincolante.",
      designKitchen: "Preferisci disegnarla? Progetta la tua cucina e inviaci la planimetria →",
      timelineLabel: "Quando spera di iniziare?",
      timelineAsap: "Il prima possibile",
      timeline2Weeks: "Entro 2 settimane",
      timeline1To3Months: "Nei prossimi 1–3 mesi",
      timelineExploring: "Per ora mi sto solo informando",
      budgetLabel: "Budget indicativo?",
      optional: "(facoltativo)",
      budgetUnder: (s) => `Meno di ${s}1.000`,
      budgetLow: (s) => `${s}1.000 – ${s}5.000`,
      budgetMid: (s) => `${s}5.000 – ${s}15.000`,
      budgetHigh: (s) => `${s}15.000 e oltre`,
      budgetUnsure: "Non lo so ancora",
      notesLabel: "C'è altro che dovremmo sapere?",
      notesPlaceholder: "Foto, tempi, accesso, qualunque cosa insolita…",
      continueCta: "Continuare",

      step3Title: "Dove dobbiamo inviarlo?",
      step3Hint: "Basta un'email o un telefono.",
      namePlaceholder: "Il suo nome",
      emailPlaceholder: "Email",
      phonePlaceholder: "Telefono",
      addressPlaceholder: "Dove sono i lavori?",
      errAddress: "Indicaci l’indirizzo dei lavori.",

      uploadLabel: "Aggiungere foto, un video o un progetto in PDF",
      uploadHint:
        "Una foto, un breve video o il suo progetto in PDF ci aiuta a preventivare con precisione.",
      uploadDocumentFallback: "Progetto in PDF",
      uploadBusy: "Caricamento…",
      uploadLimit: (n) => `Può allegare fino a ${n} file.`,
      uploadFailed:
        "Caricamento non riuscito — controlli la connessione e riprovi.",
      uploadRejected: "Non è stato possibile caricare quel file.",
      uploadTooLarge: (size, limit) => `Quel file è di ${size}: il massimo per singolo caricamento è ${limit}. Scatta la foto a dimensioni minori, oppure ridimensionala e riprova.`,
      uploadRemove: "Rimuovi",
      back: "Indietro",
      sendCta: "Inviare la mia richiesta",
      noObligation: (company) =>
        `Senza impegno. ${company} le risponderà con un prezzo.`,

      errName: "Ci dica il suo nome, per favore.",
      errContact:
        "Aggiunga un'email o un numero di telefono per poterle rispondere.",
      errSend: "Non è stato possibile inviare la sua richiesta.",
      linkInvalid: "Questo link non è valido.",
      linkInvalidHint:
        "Controlli il link, oppure contatti direttamente l'impresa.",

      confirmTitle: "Richiesta ricevuta",
      confirmIntro: (company) =>
        `${company} ha tutto quello che segue e le risponderà con un prezzo.`,
      requestedHeading: "Che cosa ha chiesto",
      nextHeading: "Che cosa succede adesso",
      next1Title: "La leggono",
      next1Body:
        "Le sue risposte arrivano subito all'impresa, insieme a tutto ciò che ha allegato.",
      next2Title: "Ne calcolano il prezzo",
      next2Body:
        "Una persona calcola il costo reale del suo lavoro — qui nulla è stato preventivato automaticamente.",
      next3Title: "Riceve un preventivo",
      next3Body:
        "Arriva come un documento che può leggere, discutere e approvare. Fino ad allora non c'è nulla di concordato.",
      estimateLabel: "Fascia stimata",
      beforeTax: "imposte escluse",
      gatedNote:
        "Non è ancora mostrato alcun prezzo — questa richiesta non è stata preventivata. È voluto: la cifra che riceverà sarà una cifra di cui una persona risponde.",
      submittedLabel: "Inviata il",
      copySentTo: (email) => `Una copia è in arrivo a ${email}.`,
      callInstead: "Le serve prima?",
      // The in-person visit offered under the confirmation. Only rendered when
      // the company can actually take a booking — see lib/booking/canBookVisit.js.
      bookVisitTitle: "Vuole che veniamo a vedere?",
      bookVisitBody:
        "Prenoti un appuntamento sul posto e le confermiamo il prezzo a casa sua.",
      bookVisitCta: "Prenotare un appuntamento",

      emailSubject: (company) => `La sua richiesta a ${company}`,
      emailIntro: (company) =>
        `Grazie — ${company} ha ricevuto la sua richiesta. Ecco che cosa ha inviato, per i suoi archivi.`,
    },

    visit: {
      eyebrow: "Il suo appuntamento",
      loadFailed: "Non siamo riusciti a caricare il suo appuntamento.",
      loadFailedHint:
        "Controlli il link nella sua email, oppure contatti direttamente l'impresa.",

      aboutEstimate: (number) => `A proposito del suo preventivo ${number}`,

      whenLabel: "Quando",
      whereLabel: "Dove",
      modeVisit: "Veniamo da lei",
      modeCall: "Telefonata — la chiamiamo noi",
      modeVideo: "Videochiamata — le inviamo un link via email",
      addressUnknown: "Indirizzo da confermare",
      depositPaid: (amount) => `Acconto di ${amount} pagato`,

      changeHeading: "Deve cambiare qualcosa?",
      rescheduleCta: "Cambiare l'orario",
      cancelCta: "Annullare questo appuntamento",

      cannotCancelled: "Questo appuntamento è già stato annullato.",
      cannotHappened: "Questo appuntamento ha già avuto luogo.",
      cannotAwaitingPayment:
        "Questo appuntamento non è ancora confermato — il pagamento non è andato a buon fine.",
      cannotNotFound: "Questo link non corrisponde ad alcun appuntamento.",
      cannotTooLate: (notice, company) =>
        `${company} chiede un preavviso di almeno ${notice}, quindi questo appuntamento non si può più cambiare da qui.`,
      cannotTooLateNoNotice: (company) =>
        `Ormai manca troppo poco al suo appuntamento perché ${company} possa accettare una modifica da qui.`,
      noticeHours: (n) => (n === 1 ? "1 ora" : `${n} ore`),
      callInstead: (company, phone) =>
        phone
          ? `Chiami ${company} al ${phone} — possono ancora spostarlo per lei.`
          : `Contatti ${company} — possono ancora spostarlo per lei.`,

      refundYes: (amount) =>
        `Il suo acconto di ${amount} sarà restituito sulla carta con cui ha pagato.`,
      refundNo: (amount) =>
        `Il suo acconto di ${amount} non viene restituito automaticamente — li contatti a questo proposito.`,
      refundAlready: (amount) =>
        `Il suo acconto di ${amount} è già stato restituito.`,

      cancelConfirmTitle: "Annullare questo appuntamento?",
      cancelConfirmBody: (company) =>
        `${company} sarà avvisata subito e il suo orario tornerà libero in calendario.`,
      yesCancel: "Sì, annullare",
      keepIt: "Tenere il mio appuntamento",
      cancelledTitle: "Appuntamento annullato",
      cancelledBody: (company) =>
        `${company} è stata avvisata. Se è stato un errore, li contatti e le troveranno un altro orario.`,
      cancelledRefunded: (amount) =>
        `Il suo acconto di ${amount} è in viaggio di ritorno. Possono volerci alcuni giorni prima che compaia sull'estratto conto.`,

      rescheduleTitle: "Scelga un nuovo orario",
      rescheduleKeep: "Tenere l'orario attuale",
      findingTimes: "Ricerca degli orari…",
      timesFailed:
        "Non siamo riusciti a caricare gli orari disponibili in questo momento.",
      pickADay: "Scelga un giorno per vedere gli orari.",
      morning: "Mattina",
      afternoon: "Pomeriggio",
      evening: "Sera",
      nothingThisMonth: "Questo mese non c'è nulla di libero.",
      tryNextMonth: "Provare il mese prossimo",
      prevMonth: "Mese precedente",
      nextMonth: "Mese successivo",
      confirmNewTime: "Spostare qui il mio appuntamento",
      movedTitle: "Il suo appuntamento è stato spostato",
      movedBody: (company) =>
        `${company} è stata avvisata e una nuova conferma è in arrivo.`,

      questions: (company, phone) =>
        phone
          ? `Domande? Chiami ${company} al ${phone}.`
          : `Domande? Contatti ${company}.`,

      slotTaken: "Quell'orario è appena stato preso. Ne scelga un altro.",
      tooSoon:
        "Quell'orario non lascia loro preavviso sufficiente. Ne scelga uno più avanti.",
      refundFailed:
        "Non siamo riusciti a restituire il suo acconto in questo momento, quindi non è stato annullato nulla. Riprovi tra poco, oppure li contatti.",
    },
  },
};

/**
 * Page copy for one language, falling back per-language to English.
 *
 * Falls back whole rather than per-key: these entries are added in complete
 * language sets, not one string at a time, so a missing language means the
 * translation hasn't been done yet and English is the safe render — never a
 * page with three English lines and one blank.
 */
export function clientDocCopy(language = "en") {
  return COPY[language] || COPY.en;
}

/**
 * The raw table, for scripts/check-language-completeness.mjs.
 *
 * The check needs to ask whether a language HAS a block, and `clientDocCopy()`
 * cannot answer that — it falls back to English, so a missing language and a
 * present one are indistinguishable through the accessor. Mirrors
 * DOCUMENT_LABELS in documentLabels.js, which exists for the same reason.
 */
export const CLIENT_DOC_COPY = COPY;
