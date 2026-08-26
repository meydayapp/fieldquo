// scripts/check-stripe-identity.mjs
//
//   npm run check:stripe-identity
//
// The owner-only "Your Stripe account" block on /app/settings/payments.
//
// ── What this is guarding ───────────────────────────────────────────────────
//
// FieldQuo holds the Connect account; the contractor's name is on it. When
// Stripe holds a payout, the person who can unblock it is Stripe — and until
// this block existed there was no screen in the product that showed the
// contractor the value Stripe uses to find their account. Stripe's own
// documentation is plain about what that value is: the ID Stripe generates
// "is different from your account's name and uniquely identifies your
// account" (docs.stripe.com/get-started/account).
//
// Four things can go wrong here and each is asserted by EXECUTION, not by
// reading the source:
//
//   1. The block leaks to a non-owner. Asserted against accountIdentityFor(),
//      which is the gate itself — the API returns no object at all rather than
//      the page hiding a div, so this is the real refusal and not a proxy for
//      one.
//   2. An account with no id renders an empty field instead of a sentence.
//   3. Stripe's machine keys reach the screen — "company.verification.document"
//      rather than a sentence a contractor can act on.
//   4. A Stripe support phone number, email address or URL gets invented.
//      Stripe does not publish a contact channel we could verify for connected
//      accounts; anything printed here would send a contractor whose money is
//      held somewhere that is not Stripe. The scan below is absolute: zero
//      stripe.com URLs, zero mailto:, zero tel:, zero phone numbers, in the
//      source AND in all six translations.

import { readFileSync } from "node:fs";
import {
  seesStripeAccountIdentity,
  accountIdentityFor,
  summariseConnectAccount,
  humaniseRequirement,
} from "@/lib/stripe/connectAccount";
import { APP_MESSAGES } from "@/app/i18n/appMessages.js";

let fail = 0;
const ok = (c, m) => {
  console.log((c ? "✓ " : "✗ ") + m);
  if (!c) fail++;
};

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const ROUTE = "app/api/stripe/connect/status/route.js";
const PAGE = "app/app/settings/payments/page.js";
const LIB = "lib/stripe/connectAccount.js";

// ── 1. Owner only, and refused at the API ──────────────────────────────────

console.log("\nWho may see the account identity\n");

ok(seesStripeAccountIdentity("owner") === true, "owner may see it");
for (const role of ["admin", "supervisor", "employee", "worker", "viewer", "", null]) {
  ok(
    seesStripeAccountIdentity(role) === false,
    `${JSON.stringify(role)} may not — narrower than isBillingAdmin (owner|admin) on purpose`,
  );
}

const ACCOUNT = {
  id: "acct_1QxTESTaccountid",
  email: "owner@example.com",
  charges_enabled: true,
  payouts_enabled: false,
  details_submitted: true,
  requirements: {
    // Deliberately overlapping: Stripe lists an overdue requirement in BOTH
    // currently_due and past_due, and showing it twice reads as two problems.
    currently_due: ["company.verification.document", "external_account"],
    past_due: ["company.verification.document"],
    pending_verification: [],
    eventually_due: ["business_profile.url"],
    disabled_reason: "requirements.past_due",
    current_deadline: 1787000000,
  },
};
const SUMMARY = summariseConnectAccount(ACCOUNT);

// The gate, executed. A hidden block is not access control — the response has
// to be empty for anyone who is not an owner.
for (const role of ["admin", "supervisor", "employee", "worker", "viewer"]) {
  ok(
    accountIdentityFor({ role, impersonation: false }, SUMMARY) === null,
    `a ${role} gets NO accountDetails object from the API — refused, not hidden`,
  );
}
ok(accountIdentityFor(null, SUMMARY) === null, "no member at all → refused");

const asOwner = accountIdentityFor({ role: "owner" }, SUMMARY);
ok(asOwner?.accountId === "acct_1QxTESTaccountid", "an owner gets the acct_ id");
ok(asOwner?.email === "owner@example.com", "and the email Stripe signs them in with");
ok(
  Object.keys(asOwner).sort().join(",") === "accountId,email",
  "and NOTHING else — no platform account id, no keys, no other tenant's ids",
);

// Non-negotiable #3: the console views everything and edits nothing. "Why is
// this company's money being held" is what a support session is opened to ask.
ok(
  accountIdentityFor({ role: "viewer", impersonation: true }, SUMMARY)?.accountId ===
    "acct_1QxTESTaccountid",
  "a read-only support session sees it too — view everything, edit nothing",
);

// ── 2. Absence is a sentence ───────────────────────────────────────────────

console.log("\nAbsence\n");

const noAccount = accountIdentityFor({ role: "owner" }, null);
ok(
  noAccount !== null && noAccount.accountId === null,
  "an owner with NO Stripe account still gets the object — so the block renders and can say so",
);
ok(
  summariseConnectAccount({ id: "acct_x" }).email === null,
  "an account with no email on file reports null rather than an empty string",
);
for (const hostile of [null, undefined, {}, { requirements: null }]) {
  const s = summariseConnectAccount(hostile);
  ok(
    s.accountId === null && s.requirements.length === 0 && s.chargesEnabled === false,
    `summariseConnectAccount(${JSON.stringify(hostile)}) is total — no throw, honest falsy values`,
  );
}

const pageSrc = read(PAGE);
ok(
  /!details\.accountId \?/.test(pageSrc) &&
    /app\.setPayments\.accountNone/.test(pageSrc),
  "the page branches on a missing account id and renders a sentence, not a blank field",
);
ok(
  /app\.setPayments\.accountEmailNone/.test(pageSrc),
  "a missing sign-in email is a sentence too",
);
// A deadline we don't have must not become one we invented.
ok(
  /currentDeadline > 0/.test(pageSrc) && /deadlineText &&/.test(pageSrc),
  "the deadline line is dropped when Stripe gave no deadline, rather than rendering an epoch",
);

// ── 3. Requirements reach the screen in words ──────────────────────────────

console.log("\nRequirement wording\n");

ok(SUMMARY.requirements.length === 2, "an overlapping currently_due/past_due entry is listed once");
for (const r of SUMMARY.requirements) {
  ok(
    r.label !== r.key && !/[._]/.test(r.label),
    `"${r.key}" renders as "${r.label}" — no machine key on screen`,
  );
}
// Title-cased on the way out, because the tidy-up that strips the dots runs
// over the injected phrase too. "A Director Or Owner: Verification Document" —
// odd-looking, and still a sentence a person can act on, which is the point.
ok(
  /^A Director Or Owner: /.test(
    humaniseRequirement("person_1TyErf.verification.document"),
  ),
  "an opaque person_ prefix becomes a person, not an id",
);
ok(
  !/person_/.test(humaniseRequirement("person_1TyErf.verification.document")),
  "and the id itself never reaches the screen",
);
// Unmapped keys must still be VISIBLE — a requirement you can't see is one you
// can't clear — just tidied.
const unmapped = humaniseRequirement("some.brand_new.stripe_key");
ok(
  unmapped.length > 0 && !/[._]/.test(unmapped),
  `an unmapped key is tidied rather than hidden: "${unmapped}"`,
);
// r.key is legitimate as a React list key; what must never happen is it being
// rendered as text. `>{r.key}<` is that, and `key={r.key}` is not.
ok(
  />\{r\.label\}</.test(pageSrc) && !/>\{r\.key\}</.test(pageSrc),
  "the block renders r.label as its text, never r.key",
);

// The route must not have grown a second copy of the wording.
const routeSrc = read(ROUTE);
ok(
  !/REQUIREMENT_LABELS/.test(routeSrc) && /summariseConnectAccount/.test(routeSrc),
  "the route uses the shared wording rather than its own copy",
);
ok(
  /accountDetails: accountIdentityFor\(member, summary\)/.test(routeSrc) &&
    !/^\s*accountId: account\.id,/m.test(routeSrc),
  "accountId is returned ONLY through the gate — no ungated copy left at the top level",
);

// The rest of the payload is what it always was. Moving accountId behind the
// gate is the ONLY shape change; the payout banner, the requirements list and
// the "already done" recheck all read the same top-level fields they did
// before, and a silent rename here would break them without a build error.
{
  // eslint-disable-next-line no-unused-vars
  const { accountId, email, ...shared } = SUMMARY;
  const topLevel = ["connected", ...Object.keys(shared), "accountDetails"].sort();
  const expected = [
    "accountDetails",
    "chargesEnabled",
    "connected",
    "currentDeadline",
    "detailsSubmitted",
    "disabledReason",
    "eventuallyDue",
    "payoutsEnabled",
    "pendingVerification",
    "requirements",
  ];
  ok(
    topLevel.join(",") === expected.join(","),
    "the status payload is unchanged apart from accountId moving behind the gate",
  );
}

// ── 4. No invented Stripe contact channel ──────────────────────────────────

console.log("\nNo invented support contact\n");

const FORBIDDEN = [
  [/support\.stripe\.com/i, "a support.stripe.com URL"],
  [/connect\.stripe\.com/i, "a connect.stripe.com URL"],
  [/dashboard\.stripe\.com/i, "a dashboard.stripe.com URL"],
  [/stripe\.com/i, "any stripe.com URL"],
  [/mailto:/i, "a mailto: link"],
  [/\btel:/i, "a tel: link"],
  [/@stripe\.com/i, "a @stripe.com email address"],
];

for (const file of [LIB, ROUTE, PAGE]) {
  const src = read(file);
  for (const [re, what] of FORBIDDEN) {
    ok(!re.test(src), `${file} contains no ${what}`);
  }
}

// The translations are the easier place for one to slip in, and the one nobody
// re-reads. A phone-shaped run of digits counts.
const NEW_KEYS = Object.keys(APP_MESSAGES.en).filter((k) =>
  k.startsWith("app.setPayments.account"),
);
ok(NEW_KEYS.length >= 25, `${NEW_KEYS.length} account-block strings to check`);

for (const [code, dict] of Object.entries(APP_MESSAGES)) {
  let missing = 0;
  let bad = 0;
  for (const key of NEW_KEYS) {
    const value = dict[key];
    if (typeof value !== "string" || value.trim() === "") {
      missing++;
      console.log(`     ${code} missing or empty: ${key}`);
      continue;
    }
    for (const [re, what] of FORBIDDEN) {
      if (re.test(value)) {
        bad++;
        console.log(`     ${code} ${key} contains ${what}`);
      }
    }
    if (/\+?\d[\d\s().-]{7,}\d/.test(value)) {
      bad++;
      console.log(`     ${code} ${key} contains something phone-shaped`);
    }
  }
  ok(missing === 0, `${code}: every account-block string is present and non-empty`);
  ok(bad === 0, `${code}: no invented Stripe contact channel`);
}

// The dashboard is where requirement problems are actually solved, so the copy
// has to send people there before it mentions anybody at Stripe at all.
ok(
  /accountWhereActive/.test(pageSrc) && /accountWhereSetup/.test(pageSrc),
  "the block points at the Stripe dashboard first, with wording that matches the button this page is actually drawing",
);
ok(
  APP_MESSAGES.en["app.setPayments.accountWhereActive"].includes(
    APP_MESSAGES.en["app.setPayments.manageInStripe"],
  ),
  "and names the button by the label the button actually carries",
);

console.log(fail === 0 ? "\nAll good.\n" : `\n${fail} problem(s).\n`);
process.exit(fail === 0 ? 0 : 1);
