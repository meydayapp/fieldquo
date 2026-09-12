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
it cannot drift from the code. 223 models.

**Read it before adding anything.** The question it answers is "what already
touches this, and what would my change touch" — which is the question that was
not asked before a change order reached no invoice, before phone hours reached
no job, and before a receipt was aimed at a table nothing reads.

`Company` is omitted from the hub list: nearly everything hangs off it by
tenancy, so it carries no information.

### The hubs — what everything attaches to

| Entity | Pointed at by | From |
|---|---:|---|
| **SalesRep** | 22 | Company, PlatformSmsNumber, SalesAttribution, SalesAttributionTouch, SalesCallAttempt, SalesCallTransfer, SalesCheckIn, SalesCommissionEntry, SalesContactNumber, SalesEvent +12 |
| **Job** | 17 | AssetUseLog, ChangeOrder, Invoice, JobDailyLog, JobDocument, JobMaterial, JobPaymentStage, JobPhoto, JobSubcontractor, JobVisit +7 |
| **Prospect** | 15 | PlatformVoiceCall, ProspectCapability, ProspectCorrection, ProspectEvidence, ProspectInference, ProspectOpportunity, ProspectScore, ProspectTalkingPoint, ProspectTechnology, SalesCallAttempt +5 |
| **Quote** | 11 | Appointment, Booking, Invoice, Job, JobPaymentStage, LeadRequest, QuoteAddOn, QuoteCosting, QuoteImport, QuoteScopeGroup +1 |
| **Worker** | 11 | LeaveBalance, LeaveRequest, LocationStamp, PayRunLine, Payout, SafetyIncident, Salary, Shift, TimeEntry, User +1 |
| **Client** | 10 | Appointment, ClientEquipment, Invoice, Job, PamphletStop, Quote, ReferralLink, SatisfactionResponse, ServicePlan, Task |
| **PlatformAdmin** | 9 | DemoBooking, DemoHostAvailability, PlatformAuditLog, PlatformSmsNumber, SalesTelemarketerRegistration, StaffMessage, StaffRoomMember, SupportTicket, SupportTicketNote |
| **SalesLead** | 9 | PlatformVoiceCall, SalesCallAttempt, SalesCheckIn, SalesContactNumber, SalesEvent, SalesLeadLinkEvent, SalesRepNote, SalesSmsMessage, SalesThread |
| **Invoice** | 6 | ChangeOrder, InvoiceCosting, JobPaymentStage, Payment, ServicePlanOccurrence, Task |
| **Member** | 5 | AssetUseLog, JobPhotoComment, JobPhotoMention, NotificationDelivery, SafetyIncident |
| **ServiceCategory** | 5 | CompanyServiceCategory, JobChecklistTemplate, LeadRequest, QuickAddItem, QuoteScopeGroup |
| **Asset** | 3 | AssetDocument, AssetUseLog, Expense |
| **MarketingCampaign** | 3 | MarketingCampaignDelivery, MarketingDesign, PamphletStop |
| **Subcontractor** | 3 | JobSubcontractor, SubcontractorDocument, SubcontractorPayment |
| **VoiceAgent** | 3 | Company, VoiceCall, VoicePhoneNumber |
| **AiEmployee** | 2 | AiEmployeeSource, Company |
| **DocumentTemplate** | 2 | FollowUpRule, MarketingCampaign |
| **Funnel** | 2 | FunnelEvent, FunnelResponse |

### Every model, both directions

<details><summary>223 models — expand</summary>

| Model | Points at | Pointed at by |
|---|---|---|
| `AiCreditBundle` | — | Company |
| `AiEmployee` | — | AiEmployeeSource, Company |
| `AiEmployeeSource` | AiEmployee | — |
| `Appointment` | Booking, Client, Quote | Booking |
| `Asset` | Debt | AssetDocument, AssetUseLog, Expense |
| `AssetDocument` | Asset | — |
| `AssetUseLog` | Asset, Job, Member | — |
| `Booking` | Appointment, EventType, Quote | Appointment |
| `ChangeOrder` | Invoice, Job | — |
| `Client` | — | Appointment, ClientEquipment, Invoice, Job, PamphletStop, Quote, ReferralLink, SatisfactionResponse, ServicePlan, Task |
| `ClientEquipment` | Client | ClientEquipmentService |
| `ClientEquipmentService` | ClientEquipment | — |
| `Company` | AiCreditBundle, AiEmployee, CompanySite, CrewInboxNumber, ForecastSettings, LinkPage, MetaAdConnection, SalesAttribution, SalesRep, Subscription, VoiceAgent, VoiceAutoTopup | AccountAbuseStrike, ActivityLog, AiCreditBundle, AiDigest, AiEmployee, AiEmployeeReply, AiEmployeeSource, AiUsage, Appointment, Asset, AssetUseLog, CallConsent, Client, ClientEquipment, CompanyFeatureOverride, CompanyServiceCategory, CompanySite, CrewInboundMessage, CrewInboxNumber, CustomField, Debt, DocumentTemplate, EventType, Expense, ExpenseImportBatch, FollowUpRule, ForecastSettings, Funnel, InstantQuoteConfig, Invoice, Job, JobChecklistTemplate, JobDailyLog, JobDocument, JobPaymentStage, JobPhoto, JobPhotoComment, JobPhotoMention, JobPhotoTag, JobSubcontractor, LeadRequest, LeavePolicy, LeaveRequest, LinkPage, LocationStamp, MarketingCampaign, MarketingDesign, MarketingSpend, MarketingSubscriber, Material, MaterialRecipeSetting, Member, MessageThread, MessagingChannel, MetaAdConnection, MetaLeadForm, MetaPageConnection, MigrationRequest, NotificationDelivery, NotificationEvent, NotificationRule, PayRun, PaymentScheduleStage, PendingTeamProfile, Product, PurchaseOrder, QuickAddItem, Quote, QuoteImport, RecordEdit, ReferralCredit, ReferralInvite, SafetyIncident, Salary, SalaryComponent, SalesAttribution, SalesAttributionTouch, SalesCheckIn, SalesCommissionEntry, SalesRep, SatisfactionResponse, ServiceCategory, ServicePlan, Shift, SmsOptOut, SocialPublish, StockMovement, Subcontractor, SubcontractorPayment, Subscription, Supplier, SupportTicket, Task, TaxRate, VehicleDetail, VoiceAgent, VoiceAutoTopup, VoiceCall, VoiceCallTask, VoiceCreditEntry, VoicePhoneNumber, WhatsAppTemplate, WorkArea, Worker, WorkingHours |
| `CompanyServiceCategory` | ServiceCategory | — |
| `CompanySite` | — | Company |
| `CrewInboxNumber` | — | Company |
| `CustomField` | — | CustomFieldValue |
| `CustomFieldValue` | CustomField | — |
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
| `Invoice` | Client, InvoiceCosting, Job, Quote, ServicePlanOccurrence | ChangeOrder, InvoiceCosting, JobPaymentStage, Payment, ServicePlanOccurrence, Task |
| `InvoiceCosting` | Invoice | Invoice |
| `JenniferConversation` | — | JenniferMessage |
| `JenniferMessage` | JenniferConversation | — |
| `Job` | Client, Quote, SatisfactionResponse | AssetUseLog, ChangeOrder, Invoice, JobDailyLog, JobDocument, JobMaterial, JobPaymentStage, JobPhoto, JobSubcontractor, JobVisit, LocationStamp, MarketingDesign, SafetyIncident, SatisfactionResponse, Shift, Task, TimeEntry |
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
| `Member` | — | AssetUseLog, JobPhotoComment, JobPhotoMention, NotificationDelivery, SafetyIncident |
| `Message` | MessageThread | — |
| `MessageThread` | MessagingChannel | Message |
| `MessagingChannel` | — | MessageThread |
| `MetaAdConnection` | — | Company |
| `MigrationDocument` | MigrationRequest | — |
| `MigrationRequest` | — | MigrationDocument, MigrationWrite |
| `MigrationWrite` | MigrationRequest | — |
| `NotificationDelivery` | Member, NotificationEvent | — |
| `NotificationEvent` | — | NotificationDelivery |
| `OrgMember` | Organization | — |
| `Organization` | — | Invitation, OrgMember |
| `PamphletStop` | Client, MarketingCampaign | — |
| `PayRun` | — | PayRunLine |
| `PayRunLine` | PayRun, Worker | — |
| `Payment` | Invoice | — |
| `PaymentScheduleStage` | — | JobPaymentStage |
| `Payout` | Worker | — |
| `Plan` | — | Subscription |
| `PlatformAdmin` | — | DemoBooking, DemoHostAvailability, PlatformAuditLog, PlatformSmsNumber, PushSubscription, SalesTelemarketerRegistration, StaffMessage, StaffRoomMember, SupportTicket, SupportTicketNote |
| `PlatformAuditLog` | PlatformAdmin | — |
| `PlatformPromoCode` | — | PlatformPromoRedemption |
| `PlatformPromoRedemption` | PlatformPromoCode | — |
| `PlatformSmsNumber` | PlatformAdmin, SalesRep | — |
| `PlatformVoiceCall` | Prospect, SalesLead | — |
| `Prospect` | ProspectCampaign, SalesTerritory | PlatformVoiceCall, ProspectCapability, ProspectCorrection, ProspectEvidence, ProspectInference, ProspectOpportunity, ProspectScore, ProspectTalkingPoint, ProspectTechnology, SalesCallAttempt, SalesContactNumber, SalesLead, SalesPlaybookAssignment, SalesQueueClaim, SalesRepNote |
| `ProspectCampaign` | SalesTerritory | Prospect |
| `ProspectCapability` | Prospect | — |
| `ProspectCorrection` | Prospect | — |
| `ProspectEvidence` | Prospect | — |
| `ProspectInference` | Prospect | — |
| `ProspectOpportunity` | FieldQuoCapability, Prospect | — |
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
| `SalesCallAttempt` | Prospect, SalesLead, SalesRep | SalesCallTransfer |
| `SalesCallTransfer` | SalesCallAttempt, SalesRep | — |
| `SalesCheckIn` | SalesLead, SalesRep, SalesSmsMessage | SalesSmsMessage |
| `SalesCommissionEntry` | SalesPayoutBatch, SalesRep | — |
| `SalesCommissionPlan` | — | SalesRep |
| `SalesContactNumber` | Prospect, SalesLead, SalesRep | — |
| `SalesEvent` | SalesLead, SalesRep | — |
| `SalesLead` | Prospect, SalesRep | PlatformVoiceCall, SalesCallAttempt, SalesCheckIn, SalesContactNumber, SalesEvent, SalesLeadLinkEvent, SalesRepNote, SalesSmsMessage, SalesThread |
| `SalesLeadLinkEvent` | SalesLead, SalesRep | — |
| `SalesMessage` | SalesThread | — |
| `SalesPayoutBatch` | SalesRep | SalesCommissionEntry |
| `SalesPlaybook` | — | SalesPlaybookExperiment |
| `SalesPlaybookAssignment` | Prospect, SalesPlaybookExperiment | — |
| `SalesPlaybookExperiment` | SalesPlaybook | SalesPlaybookAssignment |
| `SalesQueueClaim` | Prospect, SalesRep | — |
| `SalesRep` | SalesCommissionPlan | Company, PlatformSmsNumber, PushSubscription, SalesAttribution, SalesAttributionTouch, SalesCallAttempt, SalesCallTransfer, SalesCheckIn, SalesCommissionEntry, SalesContactNumber, SalesEvent, SalesLead, SalesLeadLinkEvent, SalesPayoutBatch, SalesQueueClaim, SalesRepActivity, SalesRepNote, SalesSmsMessage, SalesThread, StaffMessage, StaffRoomMember, SupportTicket, SupportTicketNote |
| `SalesRepActivity` | SalesRep | — |
| `SalesRepNote` | Prospect, SalesLead, SalesRep, SalesThread | — |
| `SalesSmsMessage` | SalesCheckIn, SalesLead, SalesRep | SalesCheckIn |
| `SalesSuppression` | — | SalesSuppressionEvent |
| `SalesSuppressionEvent` | SalesSuppression | — |
| `SalesTelemarketerRegistration` | PlatformAdmin | — |
| `SalesTerritory` | — | Prospect, ProspectCampaign |
| `SalesThread` | SalesLead, SalesRep | SalesMessage, SalesRepNote |
| `SatisfactionResponse` | Client, Job | Job |
| `ServiceCategory` | — | CompanyServiceCategory, JobChecklistTemplate, LeadRequest, QuickAddItem, QuoteScopeGroup |
| `ServicePlan` | Client, ServicePlanAuthorisation | ServicePlanAuthorisation, ServicePlanOccurrence |
| `ServicePlanAuthorisation` | ServicePlan | ServicePlan |
| `ServicePlanOccurrence` | Invoice, ServicePlan | Invoice |
| `Shift` | Job, Worker | — |
| `SocialPublish` | MarketingDesign | — |
| `StaffMessage` | PlatformAdmin, SalesRep, StaffRoom | — |
| `StaffRoom` | — | StaffMessage, StaffRoomMember |
| `StaffRoomMember` | PlatformAdmin, SalesRep, StaffRoom | — |
| `Subcontractor` | — | JobSubcontractor, SubcontractorDocument, SubcontractorPayment |
| `SubcontractorDocument` | Subcontractor | — |
| `SubcontractorPayment` | JobSubcontractor, Subcontractor | — |
| `Subscription` | Plan | Company |
| `Supplier` | — | PurchaseOrder |
| `SupportTicket` | PlatformAdmin, SalesRep | SupportTicketNote |
| `SupportTicketNote` | PlatformAdmin, SalesRep, SupportTicket | — |
| `Task` | Client, Invoice, Job, Quote, WorkArea | JobPhoto |
| `TimeEntry` | Job, Worker | LocationStamp |
| `User` | Worker | Account, AccountDevice, Appointment, AvailabilitySchedule, ChangeOrder, EventType, Funnel, Invoice, JobMaterial, JobVisit, LeadNote, LeadRequest, MarketingCampaign, MarketingDesign, Member, OrgMember, PamphletStop, PushSubscription, Quote, Session, Shift, Task, TimeEntry, TwoFactor, WorkAreaAssignment, Worker, WorkingHours |
| `VehicleDetail` | — | VehicleMaintenance |
| `VehicleMaintenance` | VehicleDetail | — |
| `VoiceAgent` | — | Company, VoiceCall, VoicePhoneNumber |
| `VoiceAutoTopup` | — | Company |
| `VoiceCall` | VoiceAgent, VoicePhoneNumber | — |
| `VoicePhoneNumber` | VoiceAgent | VoiceCall |
| `WorkArea` | — | Task, WorkAreaAssignment |
| `WorkAreaAssignment` | WorkArea | — |
| `Worker` | — | LeaveBalance, LeaveRequest, LocationStamp, PayRunLine, Payout, SafetyIncident, Salary, Shift, TimeEntry, User, WorkerSalaryComponent |
| `WorkerSalaryComponent` | SalaryComponent, Worker | — |

</details>
