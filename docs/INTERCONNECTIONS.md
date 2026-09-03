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
$40  first payment ← invoice.payment_succeeded
                      billing_reason = subscription_create
                      AND amount_paid > 0                (the free month is $0)
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
it cannot drift from the code. 186 models.

**Read it before adding anything.** The question it answers is "what already
touches this, and what would my change touch" — which is the question that was
not asked before a change order reached no invoice, before phone hours reached
no job, and before a receipt was aimed at a table nothing reads.

`Company` is omitted from the hub list: nearly everything hangs off it by
tenancy, so it carries no information.

### The hubs — what everything attaches to

| Entity | Pointed at by | From |
|---|---:|---|
| **Job** | 14 | AssetUseLog, ChangeOrder, Invoice, JobDailyLog, JobDocument, JobMaterial, JobPaymentStage, JobPhoto, JobVisit, SafetyIncident +4 |
| **Prospect** | 11 | ProspectCapability, ProspectCorrection, ProspectEvidence, ProspectInference, ProspectOpportunity, ProspectScore, ProspectTalkingPoint, ProspectTechnology, SalesLead, SalesPlaybookAssignment +1 |
| **Quote** | 11 | Appointment, Booking, Invoice, Job, JobPaymentStage, LeadRequest, QuoteAddOn, QuoteCosting, QuoteImport, QuoteScopeGroup +1 |
| **Client** | 10 | Appointment, ClientEquipment, Invoice, Job, PamphletStop, Quote, ReferralLink, SatisfactionResponse, ServicePlan, Task |
| **Worker** | 10 | LeaveBalance, LeaveRequest, PayRunLine, Payout, SafetyIncident, Salary, Shift, TimeEntry, User, WorkerSalaryComponent |
| **SalesRep** | 9 | Company, SalesAttribution, SalesAttributionTouch, SalesCommissionEntry, SalesLead, SalesPayoutBatch, SalesRepNote, SalesSmsMessage, SalesThread |
| **Invoice** | 6 | ChangeOrder, InvoiceCosting, JobPaymentStage, Payment, ServicePlanOccurrence, Task |
| **Member** | 5 | AssetUseLog, JobPhotoComment, JobPhotoMention, NotificationDelivery, SafetyIncident |
| **ServiceCategory** | 5 | CompanyServiceCategory, JobChecklistTemplate, LeadRequest, QuickAddItem, QuoteScopeGroup |
| **MarketingCampaign** | 3 | MarketingCampaignDelivery, MarketingDesign, PamphletStop |
| **PlatformAdmin** | 3 | DemoBooking, DemoHostAvailability, PlatformAuditLog |
| **SalesLead** | 3 | SalesRepNote, SalesSmsMessage, SalesThread |
| **VoiceAgent** | 3 | Company, VoiceCall, VoicePhoneNumber |
| **DocumentTemplate** | 2 | FollowUpRule, MarketingCampaign |
| **Funnel** | 2 | FunnelEvent, FunnelResponse |
| **JobPhoto** | 2 | JobPhotoComment, JobPhotoTagOnPhoto |
| **LeadRequest** | 2 | LeadNote, Quote |
| **LeavePolicy** | 2 | LeaveBalance, LeaveRequest |

### Every model, both directions

<details><summary>186 models — expand</summary>

| Model | Points at | Pointed at by |
|---|---|---|
| `AiCreditBundle` | — | Company |
| `Appointment` | Booking, Client, Quote | Booking |
| `Asset` | Debt | AssetUseLog |
| `AssetUseLog` | Asset, Job, Member | — |
| `Booking` | Appointment, EventType, Quote | Appointment |
| `ChangeOrder` | Invoice, Job | — |
| `Client` | — | Appointment, ClientEquipment, Invoice, Job, PamphletStop, Quote, ReferralLink, SatisfactionResponse, ServicePlan, Task |
| `ClientEquipment` | Client | ClientEquipmentService |
| `ClientEquipmentService` | ClientEquipment | — |
| `Company` | AiCreditBundle, CompanySite, CrewInboxNumber, ForecastSettings, LinkPage, MetaAdConnection, SalesAttribution, SalesRep, Subscription, VoiceAgent, VoiceAutoTopup | AccountAbuseStrike, ActivityLog, AiCreditBundle, AiDigest, AiUsage, Appointment, Asset, AssetUseLog, CallConsent, Client, ClientEquipment, CompanyFeatureOverride, CompanyServiceCategory, CompanySite, CrewInboundMessage, CrewInboxNumber, CustomField, Debt, DocumentTemplate, EventType, Expense, ExpenseImportBatch, FollowUpRule, ForecastSettings, Funnel, InstantQuoteConfig, Invoice, Job, JobChecklistTemplate, JobDailyLog, JobDocument, JobPaymentStage, JobPhoto, JobPhotoComment, JobPhotoMention, JobPhotoTag, LeadRequest, LeavePolicy, LeaveRequest, LinkPage, MarketingCampaign, MarketingDesign, MarketingSpend, MarketingSubscriber, Material, MaterialRecipeSetting, Member, MetaAdConnection, MigrationRequest, NotificationDelivery, NotificationEvent, NotificationRule, PayRun, PaymentScheduleStage, PendingTeamProfile, Product, PurchaseOrder, QuickAddItem, Quote, QuoteImport, RecordEdit, ReferralCredit, ReferralInvite, SafetyIncident, Salary, SalaryComponent, SalesAttribution, SalesAttributionTouch, SalesCommissionEntry, SalesRep, SatisfactionResponse, ServiceCategory, ServicePlan, Shift, SmsOptOut, SocialPublish, StockMovement, Subscription, Supplier, Task, TaxRate, VehicleDetail, VoiceAgent, VoiceAutoTopup, VoiceCall, VoiceCallTask, VoiceCreditEntry, VoicePhoneNumber, WorkArea, Worker, WorkingHours |
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
| `Expense` | ExpenseImportBatch, Material | MaterialPriceEntry |
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
| `Job` | Client, Quote, SatisfactionResponse | AssetUseLog, ChangeOrder, Invoice, JobDailyLog, JobDocument, JobMaterial, JobPaymentStage, JobPhoto, JobVisit, SafetyIncident, SatisfactionResponse, Shift, Task, TimeEntry |
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
| `JobVisit` | Job | — |
| `LeadNote` | LeadRequest | — |
| `LeadRequest` | Quote, ServiceCategory | LeadNote, Quote |
| `LeaveBalance` | LeavePolicy, Worker | — |
| `LeavePolicy` | — | LeaveBalance, LeaveRequest |
| `LeaveRequest` | LeavePolicy, Worker | — |
| `LinkPage` | — | Company |
| `MarketingCampaign` | DocumentTemplate | MarketingCampaignDelivery, MarketingDesign, PamphletStop |
| `MarketingCampaignDelivery` | MarketingCampaign, MarketingSubscriber | — |
| `MarketingDesign` | MarketingCampaign | MarketingDesignLayout, SocialPublish |
| `MarketingDesignLayout` | MarketingDesign | — |
| `MarketingSubscriber` | — | MarketingCampaignDelivery |
| `Material` | — | Expense, MaterialPriceEntry |
| `MaterialPriceEntry` | Expense, Material | — |
| `Member` | — | AssetUseLog, JobPhotoComment, JobPhotoMention, NotificationDelivery, SafetyIncident |
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
| `PlatformAdmin` | — | DemoBooking, DemoHostAvailability, PlatformAuditLog |
| `PlatformAuditLog` | PlatformAdmin | — |
| `PlatformPromoCode` | — | PlatformPromoRedemption |
| `PlatformPromoRedemption` | PlatformPromoCode | — |
| `Prospect` | ProspectCampaign, SalesTerritory | ProspectCapability, ProspectCorrection, ProspectEvidence, ProspectInference, ProspectOpportunity, ProspectScore, ProspectTalkingPoint, ProspectTechnology, SalesLead, SalesPlaybookAssignment, SalesRepNote |
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
| `SalesCommissionEntry` | SalesPayoutBatch, SalesRep | — |
| `SalesCommissionPlan` | — | SalesRep |
| `SalesLead` | Prospect, SalesRep | SalesRepNote, SalesSmsMessage, SalesThread |
| `SalesMessage` | SalesThread | — |
| `SalesPayoutBatch` | SalesRep | SalesCommissionEntry |
| `SalesPlaybook` | — | SalesPlaybookExperiment |
| `SalesPlaybookAssignment` | Prospect, SalesPlaybookExperiment | — |
| `SalesPlaybookExperiment` | SalesPlaybook | SalesPlaybookAssignment |
| `SalesRep` | SalesCommissionPlan | Company, SalesAttribution, SalesAttributionTouch, SalesCommissionEntry, SalesLead, SalesPayoutBatch, SalesRepNote, SalesSmsMessage, SalesThread |
| `SalesRepNote` | Prospect, SalesLead, SalesRep, SalesThread | — |
| `SalesSmsMessage` | SalesLead, SalesRep | — |
| `SalesSuppression` | — | SalesSuppressionEvent |
| `SalesSuppressionEvent` | SalesSuppression | — |
| `SalesTerritory` | — | Prospect, ProspectCampaign |
| `SalesThread` | SalesLead, SalesRep | SalesMessage, SalesRepNote |
| `SatisfactionResponse` | Client, Job | Job |
| `ServiceCategory` | — | CompanyServiceCategory, JobChecklistTemplate, LeadRequest, QuickAddItem, QuoteScopeGroup |
| `ServicePlan` | Client, ServicePlanAuthorisation | ServicePlanAuthorisation, ServicePlanOccurrence |
| `ServicePlanAuthorisation` | ServicePlan | ServicePlan |
| `ServicePlanOccurrence` | Invoice, ServicePlan | Invoice |
| `Shift` | Job, Worker | — |
| `SocialPublish` | MarketingDesign | — |
| `Subscription` | Plan | Company |
| `Supplier` | — | PurchaseOrder |
| `Task` | Client, Invoice, Job, Quote, WorkArea | JobPhoto |
| `TimeEntry` | Job, Worker | — |
| `User` | Worker | Account, AccountDevice, Appointment, AvailabilitySchedule, ChangeOrder, EventType, Funnel, Invoice, JobMaterial, JobVisit, LeadNote, LeadRequest, MarketingCampaign, Member, OrgMember, PamphletStop, Quote, Session, Shift, Task, TimeEntry, TwoFactor, WorkAreaAssignment, Worker, WorkingHours |
| `VehicleDetail` | — | VehicleMaintenance |
| `VehicleMaintenance` | VehicleDetail | — |
| `VoiceAgent` | — | Company, VoiceCall, VoicePhoneNumber |
| `VoiceAutoTopup` | — | Company |
| `VoiceCall` | VoiceAgent, VoicePhoneNumber | — |
| `VoicePhoneNumber` | VoiceAgent | VoiceCall |
| `WorkArea` | — | Task, WorkAreaAssignment |
| `WorkAreaAssignment` | WorkArea | — |
| `Worker` | — | LeaveBalance, LeaveRequest, PayRunLine, Payout, SafetyIncident, Salary, Shift, TimeEntry, User, WorkerSalaryComponent |
| `WorkerSalaryComponent` | SalaryComponent, Worker | — |

</details>
