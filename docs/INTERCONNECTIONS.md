# Interconnections — read this before adding a model or a number

Asserted by `scripts/check-interconnections.mjs`, in `check:all`. When a flow
changes, that check fails and this file gets corrected. **A map nobody verifies
is a map of what someone believed on the day they wrote it.**

## Why this exists

Three features shipped in one week where a number reached a screen and reached
no total. Each was written by someone who had read a comment saying it would.

| What | Where it went | What read it |
|---|---|---|
| `ChangeOrder.priceDelta` | a form, a list, a KPI | **no invoice, no margin** |
| Phone-punched `TimeEntry` | created with no `jobId` | **job costing filters on `jobId`** |
| A receipt aimed at `JobMaterial.actualCost` | a sourcing row | **costing never reads that table** |

All the same shape: **a plausible destination that nothing consumes.** A
document describing the intended flows would have caught none of them, because
it would have described the intention.

**So the rule is: before you write a number anywhere, find who reads it.**
Not who *should* — who does, today, in code you have opened.

---

## Money: what reaches a job's margin

```
                    ┌─ Expense (projectId = job)  ──┐
ACTUAL COST  ←──────┼─ TimeEntry (jobId)          ──┤──→ actualJobCost()
                    └─ AssetUseLog                ──┘

REVENUE      ←──────  Quote.total  +  approved ChangeOrder.priceDelta

MARGIN       =  revenue − actual cost
```

**`JobMaterial` is NOT in this.** It is the sourcing list — what to buy —
written only by `lib/jobs/sourcingList.js`. Its comment says "`actualCost` is
what the receipt said", which is true about intent and silent about
consequence. Prefilling it is useful; it moves no margin.

**A receipt therefore lands on `Expense`** — `receiptUrl`,
`receiptCapturedAt`, `receiptExtract` (verbatim, before any edit),
`vendorName`, `supplierId`. That is the row costing sums.

**A time entry must carry `jobId`** or the hours are invisible. The self-serve
clock omitted it, so every hour punched on a phone vanished from the job.

## Money: what reaches an invoice

An approved change order reaches a draft invoice **explicitly** — a person
presses a button, with a loud warning while agreed changes are unbilled.
Payment stages keep their agreed figures; the card *says* the stages do not
cover £X rather than silently re-basing a deposit the client already saw.

## Money: what earns a sales commission

```
$20  activation    ← Company.stripeChargesEnabled       (Connect KYC done)
$40  renewed       ← invoice.payment_succeeded
                      billing_reason = subscription_cycle (free or paid — the
                      boundary is the signal; subscription_create is trial
                      start and is always $0 on this account)
$65  retention     ← 60 days from Subscription.createdAt (TRIAL INCLUDED)
                      still active, not cancelled, no refund, no chargeback
```

**Never gated on onboarding completeness** — a one-person shop can never
complete it, so that gate pays nothing on a whole class of real sale.

## Truth: who is on trial, and who never paid

```
Subscription row exists   → checkout completed
Subscription.status       → Stripe's own word; the trial authority
billingStartedAt          → first real money (null = still unpaid)
trialEndsAt               → when the trial was MEANT to end (never cleared)
onboardingStatus          → pending at creation, active at checkout,
                            churned only when a human clicks
```

**No subscription row = never completed checkout.** Not `onboardingStatus`
(flips at trial *start*), not `trialEndsAt` (stamped before checkout, present
on all ten abandoned signups).

## Boundaries that must not be crossed

| Rule | Enforced by |
|---|---|
| One file talks to the model vendor | `lib/ai/provider.js` |
| One helper answers "is this a demo" | `lib/demo/simulatedSpend.js` |
| A concurrency guard goes in the `where`, never an `if` above it | `lib/concurrency/staleWrite.js` |
| A recommendation may only cite a real capability | `ProspectOpportunity.capabilityCode` FK → `FieldQuoCapability` |
| A rep never writes their own attribution or ledger | `lib/sales/gate.js` |
| FieldQuo's own spend is not a tenant's | `PlatformAiUsage`, `PlatformVoiceCall` |
| The one scheduled deletion is of FieldQuo's own page-view rows, never a tenant's | `lib/analytics/product/store.js` — `AnalyticsEvent` only, by day, after the day's counts are on `AnalyticsDaily` |

## Three-valued fields — `null` is not `false`

| Field | `null` means |
|---|---|
| `ProspectCapability.value` | we could not look — **not** "they don't have it" |
| `ClientEquipment.warrantyEndsAt` | unknown — **not** "out of warranty" |
| `Prospect.hasWebsite` | not checked — **not** "no website" |
| `providerCostCents` | the vendor gave no figure — **not** free |

Collapsing any of these produces a confident false statement to a customer.

## Before adding a model, check these first

- **A lead?** `SalesLead` (rep pipeline) vs `Prospect` (discovered, org-wide)
  vs `LeadRequest` (a tenant's inbound). Three, deliberately.
- **A vehicle?** `Asset` with `category: "vehicle"` already exists and carries
  depreciation. `VehicleDetail` extends it; it does not replace it.
- **Equipment?** `Asset` is the contractor's own. `ClientEquipment` is their
  customer's.
- **A document?** `lib/documents/` is PDF **rendering**. `JobDocument` is
  document **management**. Different things, confusingly named.
- **A ledger?** `VoiceCreditEntry`, `SalesCommissionEntry` and `StockMovement`
  are all append-only, summed not stored, reversals as negative rows. Follow
  that shape rather than inventing a fourth.

---

# The entity graph — what touches what

**This is the part to read before building anything.** The money flows below
answer "where does this number land". This answers "what else does my change
touch, and does something like it already exist".

Generated from the schema by `scripts/gen-interconnections.mjs`, so it cannot
drift. Regenerate after any schema change; `check:interconnections` fails if it
is stale.

## The four things everything hangs off

```
                        ┌─────────┐
                        │ CLIENT  │  ← quotes, jobs, invoices, appointments,
                        └────┬────┘    equipment, service plans, satisfaction,
                             │         referral links, pamphlet stops, tasks
                             ▼
       ┌──────────────── QUOTE ─────────────────┐
       │  scope groups · costing · add-ons      │
       │  imports · lead request · booking      │
       │  appointment                           │
       └────────────────┬───────────────────────┘
                        │ accepted
                        ▼
    ┌──────────────── JOB ────────────────────────────┐
    │  visits ─────────→ calendar, assigned worker    │
    │  materials ──────→ sourcing, receipts           │
    │  photos ─────────→ comments, @mentions, AI      │
    │  daily logs ─────→ documents                    │
    │  change orders ──→ invoice, contract value      │
    │  time entries ───→ payroll, job costing         │
    │  asset use ──────→ depreciation, overhead       │
    │  payment stages ─→ deposits, progress billing   │
    │  safety incidents                               │
    │  tasks                                          │
    └────────────────┬────────────────────────────────┘
                     ▼
              ┌───────────┐
              │  INVOICE  │ → payments, costing, service-plan occurrences
              └───────────┘
```

`WORKER` is the fifth hub and cuts across all of it: time entries, shifts,
leave, salary, pay runs, payouts, safety incidents.

## Worked example — where a receipt reaches

The owner's own question, traced through the graph:

```
receipt photo
   → Expense (projectId = job, receiptUrl, receiptExtract)
        → job costing sums Expense by projectId
             → actual cost
                  → margin  =  (quote total + approved change orders) − actual
                       → job costing panel
                       → KPIs, estimate accuracy, win/loss
   → JobMaterial.actualCost (the sourcing row — useful, reads no total)
   → Supplier / PurchaseOrder / StockMovement (if it came from a PO)
```

**Five things move because of one photograph.** That is why the destination
mattered, and why aiming it at `JobMaterial` alone changed nothing a
contractor would ever see.

## Before you build

Ask three questions of this graph:

1. **Does it already exist?** Three lead concepts, three ledgers, two
   "documents" — all deliberate, all easy to duplicate by accident.
2. **What points at what I am changing?** The hub table below is ranked by
   inbound relations. Fourteen things point at `Job`.
3. **Who READS the number I am writing?** Not who should. Who does, in code
   you have opened. That is the question the three failures above share.

<!-- GENERATED by scripts/gen-interconnections.mjs — do not hand-edit this section -->

## The entity graph

Every model, and what points at it. Generated from `prisma/schema.prisma`, so
it cannot drift from the code. 284 models.

**Read it before adding anything.** The question it answers is "what already
touches this, and what would my change touch" — which is the question that was
not asked before a change order reached no invoice, before phone hours reached
no job, and before a receipt was aimed at a table nothing reads.

`Company` is omitted from the hub list: nearly everything hangs off it by
tenancy, so it carries no information.

### The hubs — what everything attaches to

| Entity | Pointed at by | From |
|---|---:|---|
| **SalesRep** | 31 | Company, PlatformAuditLog, PlatformSmsNumber, PushSubscription, SalesAttribution, SalesAttributionTouch, SalesCallAttempt, SalesCallTransfer, SalesCheckIn, SalesCommissionEntry +21 |
| **Job** | 21 | Appointment, AssetUseLog, ChangeOrder, CompanyChatRoom, DailyObjectiveSheet, Invoice, JobDailyLog, JobDocument, JobMaterial, JobPaymentStage +11 |
| **Worker** | 21 | AvailabilityRequest, DailyObjectiveSheet, LeaveBalance, LeaveRequest, LocationStamp, OnboardingRun, PayRunLine, Payout, PolicyAcknowledgement, SafetyIncident +11 |
| **Prospect** | 18 | PlatformVoiceCall, ProspectCapability, ProspectCorrection, ProspectEvidence, ProspectInference, ProspectOpportunity, ProspectPerson, ProspectScore, ProspectTalkingPoint, ProspectTechnology +8 |
| **PlatformAdmin** | 16 | DemoBooking, DemoHostAvailability, PlatformAuditLog, PlatformFixedBill, PlatformSmsNumber, PushSubscription, SalesCallAttempt, SalesCallEvent, SalesJurisdictionOverride, SalesTelemarketerRegistration +6 |
| **Client** | 12 | Appointment, CallbackEntry, ClientEquipment, Invoice, Job, MessageThread, PamphletStop, Quote, ReferralLink, SatisfactionResponse +2 |
| **SalesLead** | 12 | PlatformVoiceCall, SalesCallAttempt, SalesCheckIn, SalesContactEmail, SalesContactNumber, SalesEmailDraft, SalesEvent, SalesIntroEmail, SalesLeadLinkEvent, SalesRepNote +2 |
| **Member** | 11 | AssetUseLog, CalendarMirror, CallbackRule, CompanyChatMember, CompanyChatMessage, JobPhotoComment, JobPhotoMention, MemberGoogleCalendar, NotificationDelivery, SafetyIncident +1 |
| **Quote** | 11 | Appointment, Booking, Invoice, Job, JobPaymentStage, LeadRequest, QuoteAddOn, QuoteCosting, QuoteImport, QuoteScopeGroup +1 |
| **Invoice** | 8 | Appointment, ChangeOrder, InvoiceCosting, JobPaymentStage, Payment, ServicePlanOccurrence, Task, TimeEntry |
| **ServiceCategory** | 6 | CompanyServiceCategory, JobChecklistTemplate, LeadRequest, QuickAddItem, QuoteScopeGroup, ServiceDocument |
| **SalesCallAttempt** | 5 | SalesCallEvent, SalesCallQa, SalesCallTransfer, SalesDispositionAudit, SalesRecordingMark |
| **Asset** | 3 | AssetDocument, AssetUseLog, Expense |
| **CompanyChatRoom** | 3 | CompanyChatMember, CompanyChatMessage, Job |
| **MarketingCampaign** | 3 | MarketingCampaignDelivery, MarketingDesign, PamphletStop |
| **SalesThread** | 3 | SalesEmailDraft, SalesMessage, SalesRepNote |
| **Shift** | 3 | ShiftAttendance, ShiftBreak, ShiftRequest |
| **Subcontractor** | 3 | JobSubcontractor, SubcontractorDocument, SubcontractorPayment |

### Every model, both directions

<details><summary>284 models — expand</summary>

| Model | Points at | Pointed at by |
|---|---|---|
| `AiCreditBundle` | — | Company |
| `AiEmployee` | — | AiEmployeeProposal, AiEmployeeSource |
| `AiEmployeeProposal` | AiEmployee | — |
| `AiEmployeeSource` | AiEmployee | — |
| `Appointment` | Booking, Client, Invoice, Job, Quote | Booking |
| `Asset` | Debt | AssetDocument, AssetUseLog, Expense |
| `AssetDocument` | Asset | — |
| `AssetUseLog` | Asset, Job, Member | — |
| `AvailabilityRequest` | Worker | — |
| `Booking` | Appointment, EventType, Quote | Appointment |
| `CalendarMirror` | Member | — |
| `CallbackEntry` | CallbackList, Client | — |
| `CallbackList` | CallbackRule | CallbackEntry |
| `CallbackRule` | Member | CallbackList |
| `ChangeOrder` | Invoice, Job | — |
| `Client` | — | Appointment, CallbackEntry, ClientEquipment, Invoice, Job, MessageThread, PamphletStop, Quote, ReferralLink, SatisfactionResponse, ServicePlan, Task |
| `ClientEquipment` | Client | ClientEquipmentService, Job |
| `ClientEquipmentService` | ClientEquipment | — |
| `Company` | AiCreditBundle, CompanyGoogleBusiness, CompanySite, CrewInboxNumber, ForecastSettings, LinkPage, MetaAdConnection, SalesAttribution, SalesRep, SignupLead, SignupOrigin, Subscription, VoiceAgent, VoiceAutoTopup | AccountAbuseStrike, ActivityLog, AiCreditBundle, AiDigest, AiEmployee, AiEmployeeProposal, AiEmployeeReply, AiEmployeeRoutingEvent, AiEmployeeSource, AiUsage, Appointment, Asset, AssetUseLog, AvailabilityRequest, CallConsent, CallbackEntry, CallbackList, CallbackRule, Client, ClientEquipment, CompanyChatMember, CompanyChatMessage, CompanyChatRoom, CompanyFeatureOverride, CompanyGoogleBusiness, CompanyServiceCategory, CompanySite, ConnectFeeRecovery, CrewInboundMessage, CrewInboxNumber, CustomField, DailyObjectiveSheet, Debt, DocumentTemplate, EventType, Expense, ExpenseImportBatch, FollowUpRule, ForecastSettings, Funnel, GoogleReview, InstantPayout, InstantQuoteConfig, Invoice, Job, JobChecklistTemplate, JobDailyLog, JobDocument, JobPaymentStage, JobPhoto, JobPhotoComment, JobPhotoMention, JobPhotoTag, JobSubcontractor, LeadRequest, LeavePolicy, LeaveRequest, LinkPage, LocationStamp, MarketingCampaign, MarketingDesign, MarketingSpend, MarketingSubscriber, Material, MaterialRecipeSetting, Member, MessageThread, MessagingChannel, MetaAdConnection, MetaLeadForm, MetaPageConnection, MigrationRequest, NotificationDelivery, NotificationEvent, NotificationRule, OfflineSyncItem, PayRun, PaymentScheduleStage, PendingTeamProfile, Product, Prospect, PurchaseOrder, QuickAddItem, Quote, QuoteImport, RecordEdit, ReferralCredit, ReferralInvite, SafetyIncident, Salary, SalaryComponent, SalesAttribution, SalesAttributionTouch, SalesCheckIn, SalesCommissionEntry, SalesRep, SatisfactionResponse, ScheduleEvent, ServiceCategory, ServiceDocument, ServicePlan, Shift, ShiftAttendance, ShiftRequest, ShoutOut, SignupLead, SignupOrigin, SmsOptOut, SocialPublish, StockMovement, Subcontractor, SubcontractorPayment, Subscription, Supplier, SupplyRequest, SupportTicket, Task, TaxRate, VehicleDetail, VoiceAgent, VoiceAutoTopup, VoiceCall, VoiceCallTask, VoiceCreditEntry, VoicePhoneNumber, WhatsAppTemplate, WorkArea, Worker, WorkingHours |
| `CompanyChatMember` | CompanyChatRoom, Member | — |
| `CompanyChatMessage` | CompanyChatRoom, Member | — |
| `CompanyChatRoom` | Job | CompanyChatMember, CompanyChatMessage, Job |
| `CompanyGoogleBusiness` | — | Company |
| `CompanyPolicy` | — | CompanyPolicyVersion, PolicyAcknowledgement |
| `CompanyPolicyVersion` | CompanyPolicy | — |
| `CompanyServiceCategory` | ServiceCategory | — |
| `CompanySite` | — | Company |
| `CrewInboxNumber` | — | Company |
| `CustomField` | — | CustomFieldValue |
| `CustomFieldValue` | CustomField | — |
| `DailyObjectiveSheet` | Job, PayRun, Worker | — |
| `Debt` | — | Asset |
| `DemoBooking` | PlatformAdmin | — |
| `DemoHostAvailability` | PlatformAdmin | — |
| `DocumentTemplate` | — | FollowUpRule, MarketingCampaign |
| `EventType` | — | Booking |
| `Expense` | Asset, ExpenseImportBatch, Material | MaterialPriceEntry |
| `ExpenseImportBatch` | — | Expense |
| `FieldQuoCapability` | — | ProspectOpportunity |
| `FollowUpLog` | FollowUpRule | — |
| `FollowUpRule` | DocumentTemplate | FollowUpLog |
| `ForecastSettings` | — | Company |
| `Funnel` | — | FunnelEvent, FunnelResponse |
| `FunnelEvent` | Funnel | — |
| `FunnelResponse` | Funnel | — |
| `Invitation` | Organization | — |
| `Invoice` | Client, InvoiceCosting, Job, Quote, ServicePlanOccurrence | Appointment, ChangeOrder, InvoiceCosting, JobPaymentStage, Payment, ServicePlanOccurrence, Task, TimeEntry |
| `InvoiceCosting` | Invoice | Invoice |
| `JenniferConversation` | — | JenniferMessage |
| `JenniferMessage` | JenniferConversation | — |
| `Job` | Client, ClientEquipment, CompanyChatRoom, Quote, SatisfactionResponse | Appointment, AssetUseLog, ChangeOrder, CompanyChatRoom, DailyObjectiveSheet, Invoice, JobDailyLog, JobDocument, JobMaterial, JobPaymentStage, JobPhoto, JobSubcontractor, JobVisit, LocationStamp, MarketingDesign, SafetyIncident, SatisfactionResponse, Shift, SupplyRequest, Task, TimeEntry |
| `JobChecklistTemplate` | ServiceCategory | — |
| `JobDailyLog` | Job | — |
| `JobDocument` | Job | — |
| `JobMaterial` | Job | — |
| `JobPaymentStage` | Invoice, Job, PaymentScheduleStage, Quote | — |
| `JobPhoto` | Job, SafetyIncident, Task | JobPhotoComment, JobPhotoTagOnPhoto |
| `JobPhotoComment` | JobPhoto, Member | JobPhotoMention |
| `JobPhotoMention` | JobPhotoComment, Member | — |
| `JobPhotoTag` | — | JobPhotoTagOnPhoto |
| `JobPhotoTagOnPhoto` | JobPhoto, JobPhotoTag | — |
| `JobSubcontractor` | Job, JobVisit, Subcontractor | SubcontractorPayment |
| `JobVisit` | Job | JobSubcontractor, LocationStamp |
| `LeadNote` | LeadRequest | — |
| `LeadRequest` | Quote, ServiceCategory | LeadNote, Quote |
| `LeaveBalance` | LeavePolicy, Worker | — |
| `LeavePolicy` | — | LeaveBalance, LeaveRequest |
| `LeaveRequest` | LeavePolicy, Worker | — |
| `LinkPage` | — | Company |
| `LocationStamp` | Job, JobVisit, TimeEntry, Worker | — |
| `MarketingCampaign` | DocumentTemplate | MarketingCampaignDelivery, MarketingDesign, PamphletStop |
| `MarketingCampaignDelivery` | MarketingCampaign, MarketingSubscriber | — |
| `MarketingDesign` | Job, MarketingCampaign | MarketingDesignLayout, SocialPublish |
| `MarketingDesignLayout` | MarketingDesign | — |
| `MarketingSubscriber` | — | MarketingCampaignDelivery |
| `Material` | — | Expense, MaterialPriceEntry |
| `MaterialPriceEntry` | Expense, Material | — |
| `Member` | MemberGoogleCalendar | AssetUseLog, CalendarMirror, CallbackRule, CompanyChatMember, CompanyChatMessage, JobPhotoComment, JobPhotoMention, MemberGoogleCalendar, NotificationDelivery, SafetyIncident, ShoutOut |
| `MemberGoogleCalendar` | Member | Member |
| `Message` | MessageThread | — |
| `MessageThread` | Client, MessagingChannel | Message |
| `MessagingChannel` | — | MessageThread |
| `MetaAdConnection` | — | Company |
| `MigrationDocument` | MigrationRequest | — |
| `MigrationRequest` | — | MigrationDocument, MigrationWrite |
| `MigrationWrite` | MigrationRequest | — |
| `NotificationDelivery` | Member, NotificationEvent | — |
| `NotificationEvent` | — | NotificationDelivery |
| `OnboardingRun` | Worker | — |
| `OrgMember` | Organization | — |
| `Organization` | — | Invitation, OrgMember |
| `PamphletStop` | Client, MarketingCampaign | — |
| `PayRun` | — | DailyObjectiveSheet, PayRunLine |
| `PayRunLine` | PayRun, Worker | — |
| `Payment` | Invoice | — |
| `PaymentScheduleStage` | — | JobPaymentStage |
| `Payout` | Worker | — |
| `Plan` | — | Subscription |
| `PlatformAdmin` | — | DemoBooking, DemoHostAvailability, PlatformAuditLog, PlatformFixedBill, PlatformSmsNumber, PushSubscription, SalesCallAttempt, SalesCallEvent, SalesJurisdictionOverride, SalesTelemarketerRegistration, SignupOrigin, StaffMessage, StaffRoom, StaffRoomMember, SupportTicket, SupportTicketNote |
| `PlatformAuditLog` | PlatformAdmin, SalesRep | — |
| `PlatformFixedBill` | PlatformAdmin | — |
| `PlatformPromoCode` | SalesCommissionPlan | PlatformPromoRedemption |
| `PlatformPromoRedemption` | PlatformPromoCode | — |
| `PlatformSmsNumber` | PlatformAdmin, SalesRep | — |
| `PlatformVoiceCall` | Prospect, SalesLead | — |
| `PolicyAcknowledgement` | CompanyPolicy, Worker | — |
| `Prospect` | ProspectCampaign, SalesTerritory, SignupLead | PlatformVoiceCall, ProspectCapability, ProspectCorrection, ProspectEvidence, ProspectInference, ProspectOpportunity, ProspectPerson, ProspectScore, ProspectTalkingPoint, ProspectTechnology, SalesCallAttempt, SalesContactNumber, SalesLead, SalesPlaybookAssignment, SalesQueueClaim, SalesRepNote, SalesSmsMessage, SignupLead |
| `ProspectCampaign` | SalesTerritory | Prospect |
| `ProspectCapability` | Prospect | — |
| `ProspectCorrection` | Prospect | — |
| `ProspectEvidence` | Prospect | — |
| `ProspectInference` | Prospect | — |
| `ProspectOpportunity` | FieldQuoCapability, Prospect | — |
| `ProspectPerson` | Prospect | — |
| `ProspectScore` | Prospect | — |
| `ProspectTalkingPoint` | Prospect | — |
| `ProspectTechnology` | Prospect | — |
| `PurchaseOrder` | Supplier | PurchaseOrderLine |
| `PurchaseOrderLine` | PurchaseOrder | — |
| `PushSubscription` | PlatformAdmin, SalesRep | — |
| `QuickAddItem` | ServiceCategory | — |
| `Quote` | Client, LeadRequest, QuoteCosting | Appointment, Booking, Invoice, Job, JobPaymentStage, LeadRequest, QuoteAddOn, QuoteCosting, QuoteImport, QuoteScopeGroup, Task |
| `QuoteAddOn` | Quote | — |
| `QuoteCosting` | Quote | Quote |
| `QuoteImport` | Quote | — |
| `QuoteScopeGroup` | Quote, ServiceCategory | — |
| `ReferralLink` | Client | — |
| `SafetyIncident` | Job, Member, Worker | JobPhoto |
| `Salary` | Worker | — |
| `SalaryComponent` | — | WorkerSalaryComponent |
| `SalesAttribution` | SalesRep | Company |
| `SalesAttributionTouch` | SalesRep | — |
| `SalesCallAttempt` | PlatformAdmin, Prospect, SalesCallQa, SalesDispositionAudit, SalesLead, SalesRep | SalesCallEvent, SalesCallQa, SalesCallTransfer, SalesDispositionAudit, SalesRecordingMark |
| `SalesCallEvent` | PlatformAdmin, SalesCallAttempt | — |
| `SalesCallQa` | SalesCallAttempt | SalesCallAttempt |
| `SalesCallTransfer` | SalesCallAttempt, SalesRep | — |
| `SalesCheckIn` | SalesLead, SalesRep, SalesSmsMessage | SalesSmsMessage |
| `SalesCommissionEntry` | SalesPayoutBatch, SalesRep | — |
| `SalesCommissionPlan` | — | PlatformPromoCode, SalesRep |
| `SalesContactEmail` | SalesLead, SalesRep | — |
| `SalesContactNumber` | Prospect, SalesLead, SalesRep | — |
| `SalesDispositionAudit` | SalesCallAttempt | SalesCallAttempt |
| `SalesEmailDraft` | SalesLead, SalesRep, SalesThread | — |
| `SalesEvent` | SalesLead, SalesRep | — |
| `SalesIntroEmail` | SalesLead, SalesRep | — |
| `SalesJurisdictionOverride` | PlatformAdmin | — |
| `SalesLead` | Prospect, SalesRep | PlatformVoiceCall, SalesCallAttempt, SalesCheckIn, SalesContactEmail, SalesContactNumber, SalesEmailDraft, SalesEvent, SalesIntroEmail, SalesLeadLinkEvent, SalesRepNote, SalesSmsMessage, SalesThread |
| `SalesLeadLinkEvent` | SalesLead, SalesRep | — |
| `SalesMailbox` | SalesRep | SalesRep, SalesThread |
| `SalesMessage` | SalesThread | — |
| `SalesPayoutBatch` | SalesRep | SalesCommissionEntry |
| `SalesPlaybook` | — | SalesPlaybookExperiment |
| `SalesPlaybookAssignment` | Prospect, SalesPlaybookExperiment | — |
| `SalesPlaybookExperiment` | SalesPlaybook | SalesPlaybookAssignment |
| `SalesQueueClaim` | Prospect, SalesRep | — |
| `SalesRecordingMark` | SalesCallAttempt | — |
| `SalesRep` | SalesCommissionPlan, SalesMailbox | Company, PlatformAuditLog, PlatformSmsNumber, PushSubscription, SalesAttribution, SalesAttributionTouch, SalesCallAttempt, SalesCallTransfer, SalesCheckIn, SalesCommissionEntry, SalesContactEmail, SalesContactNumber, SalesEmailDraft, SalesEvent, SalesIntroEmail, SalesLead, SalesLeadLinkEvent, SalesMailbox, SalesPayoutBatch, SalesQueueClaim, SalesRepActivity, SalesRepNote, SalesSmsMessage, SalesThread, SignupLead, SignupOrigin, StaffMessage, StaffRoom, StaffRoomMember, SupportTicket, SupportTicketNote |
| `SalesRepActivity` | SalesRep | — |
| `SalesRepNote` | Prospect, SalesLead, SalesRep, SalesThread | — |
| `SalesSmsMessage` | Prospect, SalesCheckIn, SalesLead, SalesRep | SalesCheckIn |
| `SalesSuppression` | — | SalesSuppressionEvent |
| `SalesSuppressionEvent` | SalesSuppression | — |
| `SalesTelemarketerRegistration` | PlatformAdmin | — |
| `SalesTerritory` | — | Prospect, ProspectCampaign |
| `SalesThread` | SalesLead, SalesMailbox, SalesRep | SalesEmailDraft, SalesMessage, SalesRepNote |
| `SatisfactionResponse` | Client, Job | Job |
| `ServiceCategory` | — | CompanyServiceCategory, JobChecklistTemplate, LeadRequest, QuickAddItem, QuoteScopeGroup, ServiceDocument |
| `ServiceDocument` | ServiceCategory | — |
| `ServicePlan` | Client, ServicePlanAuthorisation | ServicePlanAuthorisation, ServicePlanOccurrence |
| `ServicePlanAuthorisation` | ServicePlan | ServicePlan |
| `ServicePlanOccurrence` | Invoice, ServicePlan | Invoice |
| `Shift` | Job, ShiftAttendance, Worker | ShiftAttendance, ShiftBreak, ShiftRequest |
| `ShiftAttendance` | Shift, Worker | Shift |
| `ShiftBreak` | Shift | — |
| `ShiftRequest` | Shift, Worker | — |
| `ShoutOut` | Member, Worker | — |
| `SignupLead` | Prospect, SalesRep | Company, Prospect |
| `SignupOrigin` | PlatformAdmin, SalesRep | Company |
| `SocialPublish` | MarketingDesign | — |
| `StaffMessage` | PlatformAdmin, SalesRep, StaffRoom | — |
| `StaffRoom` | PlatformAdmin, SalesRep | StaffMessage, StaffRoomMember |
| `StaffRoomMember` | PlatformAdmin, SalesRep, StaffRoom | — |
| `Subcontractor` | — | JobSubcontractor, SubcontractorDocument, SubcontractorPayment |
| `SubcontractorDocument` | Subcontractor | — |
| `SubcontractorPayment` | JobSubcontractor, Subcontractor | — |
| `Subscription` | Plan | Company |
| `Supplier` | — | PurchaseOrder |
| `SupplyRequest` | Job | — |
| `SupportTicket` | PlatformAdmin, SalesRep | SupportTicketNote |
| `SupportTicketNote` | PlatformAdmin, SalesRep, SupportTicket | — |
| `Task` | Client, Invoice, Job, Quote, WorkArea | JobPhoto |
| `TaxFormSubmission` | Worker | — |
| `TimeEntry` | Invoice, Job, Worker | LocationStamp, TimeEntryBreak |
| `TimeEntryBreak` | TimeEntry | — |
| `User` | Worker | Account, AccountDevice, Appointment, AvailabilityRequest, AvailabilitySchedule, CallbackEntry, ChangeOrder, DailyObjectiveSheet, EventType, Funnel, Invoice, JobMaterial, JobVisit, LeadNote, LeadRequest, MarketingCampaign, MarketingDesign, Member, OrgMember, PamphletStop, PushSubscription, Quote, ScheduleEvent, Session, Shift, ShiftRequest, SupplyRequest, Task, TimeEntry, TwoFactor, WorkAreaAssignment, Worker, WorkingHours |
| `VehicleDetail` | — | VehicleMaintenance |
| `VehicleMaintenance` | VehicleDetail | — |
| `VoiceAgent` | — | Company, VoiceCall, VoicePhoneNumber |
| `VoiceAutoTopup` | — | Company |
| `VoiceCall` | VoiceAgent, VoicePhoneNumber | — |
| `VoicePhoneNumber` | VoiceAgent | VoiceCall |
| `WorkArea` | — | Task, WorkAreaAssignment |
| `WorkAreaAssignment` | WorkArea | — |
| `Worker` | — | AvailabilityRequest, DailyObjectiveSheet, LeaveBalance, LeaveRequest, LocationStamp, OnboardingRun, PayRunLine, Payout, PolicyAcknowledgement, SafetyIncident, Salary, Shift, ShiftAttendance, ShiftRequest, ShoutOut, TaxFormSubmission, TimeEntry, User, WorkerDocument, WorkerNote, WorkerSalaryComponent |
| `WorkerDocument` | Worker | — |
| `WorkerNote` | Worker | — |
| `WorkerSalaryComponent` | SalaryComponent, Worker | — |

</details>
