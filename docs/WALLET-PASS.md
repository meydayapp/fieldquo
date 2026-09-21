# The digital business card on a phone: Apple Wallet, Google Wallet, and what NFC can and cannot do

Written for the owner. The code is live; the two wallet buttons on
Settings → Reviews say "not set up yet" and name the missing variable until
the steps below are done. Everything else on that screen — the card, the QR,
the print sheet, the NFC tag — works with no setup at all.

## What it is

Every company has a public **digital business card** at
`https://www.fieldquo.com/c/<slug>` (the same slug as `/book`, `/quote` and
`/l`; it also answers on the company's own subdomain). It shows the logo,
name, address with a map link, tap-to-call, email, **Save our contact** (a
vCard the phone opens straight into Contacts), and every row the bio link
has: book a visit, get an instant price, leave a Google review, the website,
the socials. Labels are in the visitor's language, falling back to the
company's. No FieldQuo anywhere on it except the small "Made by" credit in
the footer that the bio link already carries by the owner's decision.

Everything that points at the card stamps where it was printed —
`?ref=sticker`, `qr`, `nfc`, `wallet`, `invoice`, `email` — and Settings →
Reviews counts them: "23 taps from the sticker sheet".

The **wallet pass** is that card for the CONTRACTOR's own phone: a card in
Apple Wallet or Google Wallet in the company's colour with the QR on it, to
hold up at the end of a job. "Scan this and tell people how it went."

## NFC, stated plainly

**A wallet pass cannot be tapped by a customer.** Apple Wallet's NFC is
Apple VAS — the enterprise programme where a merchant's own certified
reader talks to Wallet — and no third-party app, and no customer's phone,
can read a pass over NFC. Google Wallet's generic passes carry no NFC at
all. The pass is a QR, held up; the customer scans it. The screen says this
next to the button so nobody buys a pass expecting a tap.

**What DOES work with every phone is a physical NFC tag.** An NTAG215
sticker costs a few cents, writes once in thirty seconds with the free NFC
Tools app, and every iPhone since the XS and every Android since 2012 opens
what is on it with no app. Settings → Reviews offers two things to write:

1. **The card's address** (`…/c/<slug>?ref=nfc`) — a tap opens the card.
   Fits any tag.
2. **The contact itself** — a vCard 3.0 with the name, phone, email, address
   and the card's address as the website. A tap prompts "Add to Contacts"
   directly, no browser. No photo (it would not fit); the screen prints the
   record's size and which tag holds it (NTAG213 = 144 B, **NTAG215 = 504
   B**, NTAG216 = 888 B, all after the ~24-byte NDEF/MIME wrapper). A
   typical company card is 300–400 bytes: an NTAG215.

Steps, as the screen prints them: install **NFC Tools** (iPhone or Android)
→ Write → Add a record → "URL/URI" and paste the address, or "Contact" and
paste the vCard text → Write, hold the phone on the blank tag → tap it with
another phone to check → stick it where customers stand.

## The print sheet

Settings → Reviews → Print sheet opens a page with the card QR large (van
door, counter) and small (magnet, business card), plus a second small QR
that IS the contact — the same no-photo vCard, so a camera prompts "Add
contact". Both captions and the printed address are in the company's
language.

---

## Apple Wallet — what the owner does once

FieldQuo needs its **own** Pass Type ID and certificate. Sunset Space's
(`pass.ca.sunsetspace.eventticket`) belongs to Sunset Space and must not be
reused: the pass type id is printed inside every pass and is what Wallet
groups passes by. The mechanics below are the same ones that certificate
went through in August 2026.

The four variables, on the Vercel project:

| Variable | Value |
|---|---|
| `APPLE_PASS_TYPE_ID` | `pass.com.fieldquo.review` |
| `APPLE_TEAM_ID` | the ten-character Team ID (Membership details on developer.apple.com — not secret) |
| `APPLE_PASS_CERT_P12_BASE64` | the certificate + private key as one `.p12`, base64 |
| `APPLE_PASS_CERT_PASSWORD` | the `.p12` password |

### 1. Make a private key and a CSR, on your Mac

```bash
mkdir -p ~/fieldquo-passcert && cd ~/fieldquo-passcert && chmod 700 .
openssl genrsa -out passkey.pem 2048
openssl req -new -key passkey.pem -out FieldQuoReview.certSigningRequest \
  -subj "/CN=FieldQuo Review Card/O=FieldQuo/C=CA" \
  -addext "subjectAltName=email:emilio.boves@gmail.com"
```

`passkey.pem` is the only copy of the private key. Apple never sees it.
Losing it means redoing the certificate. Keep the folder outside every git
repository, exactly as `~/sunset-space-passcert` is.

### 2. Register the Pass Type ID

developer.apple.com → **Certificates, Identifiers & Profiles** →
**Identifiers** → **+** → **Pass Type IDs** → Continue.

- Description: `FieldQuo Review Card`
- Identifier: `pass.com.fieldquo.review`

Register.

### 3. Create the certificate

Identifiers → open `pass.com.fieldquo.review` → **Create Certificate** →
upload `FieldQuoReview.certSigningRequest` → Continue → **Download**
(`pass.cer`).

The issuer is Apple Worldwide Developer Relations **G4** for every pass
certificate issued today; `lib/reviews/wallet/wwdrG4.js` carries that
intermediate. If step 4 prints a different issuer (G5, G6), say so — that
file is the one to swap.

### 4. Pair it with the key into a `.p12`

Copy `~/sunset-space-passcert/make-p12.sh` into the new folder and run it
against the new `pass.cer`, or by hand:

```bash
cd ~/fieldquo-passcert
openssl x509 -inform DER -in ~/Downloads/pass.cer -out passcert.pem
# must print the same md5 twice — the cert matches the key
openssl x509 -noout -modulus -in passcert.pem | openssl md5
openssl rsa  -noout -modulus -in passkey.pem  | openssl md5
openssl x509 -in passcert.pem -noout -subject -issuer -enddate
openssl pkcs12 -export -out Certificates.p12 -inkey passkey.pem -in passcert.pem
base64 -i Certificates.p12 | pbcopy      # → APPLE_PASS_CERT_P12_BASE64
```

Choose a long random password at the `-export` prompt (`openssl rand -hex
24`); that is `APPLE_PASS_CERT_PASSWORD`. Never paste it into chat.

### 5. Set the four variables, redeploy, test

Vercel → Settings → Environment Variables → the four rows → redeploy.
Settings → Reviews → **Add to Apple Wallet** downloads a `.pkpass`; open
it on an iPhone. If Wallet says "Sorry, your pass cannot be installed", the
chain is wrong (step 3's issuer) or the `.p12` has no key (step 4's md5
check).

### The date that matters

Pass Type ID certificates are valid for **one year** (step 4's `enddate`
prints it). After it, new passes cannot be signed; passes already on phones
survive. Put the date in the calendar; renewing is steps 3–5 again with the
same key.

---

## Google Wallet — what the owner does once

No certificate and no annual expiry. A pass is a JWT signed by a service
account, carrying the class and object inline; Google creates both on
save. Nothing is written through the Wallet API, so no auth library.

| Variable | Value |
|---|---|
| `GOOGLE_WALLET_ISSUER_ID` | the issuer number the Wallet console shows |
| `GOOGLE_WALLET_SERVICE_ACCOUNT_JSON` | the service account's JSON key, base64 |

### 1. Wallet console

[pay.google.com/business/console](https://pay.google.com/business/console)
→ sign in with the FieldQuo Google account → **Google Wallet API** →
create the issuer. Business name **FieldQuo** is what Google shows the
owner, not the customer: a saved pass shows the contractor's name and
colour. Note the **Issuer ID** (a 19-digit number).

New issuers start in **demo mode**: only test users listed under the
issuer can save a pass. Add the owner's own Google account there first.
Publishing access (so any contractor can save one) is a form under the
same console — Google reviews the class design; the generic pass here is
the plainest kind and has been approved routinely.

### 2. Service account

console.cloud.google.com → the FieldQuo project (the same one the OAuth
client and Maps key live in) → **APIs & Services** → enable **Google
Wallet API** → **Credentials** → **Create credentials → Service account**
(name `fieldquo-wallet`) → **Keys → Add key → JSON**. Download it.

Back in the Wallet console → **Users** → add the service account's email
(`fieldquo-wallet@<project>.iam.gserviceaccount.com`) with **Developer**
access. Without this the JWT signs fine and Google refuses the save.

```bash
base64 -i ~/Downloads/<project>-xxxx.json | pbcopy   # → GOOGLE_WALLET_SERVICE_ACCOUNT_JSON
```

### 3. Set the two variables, redeploy, test

Settings → Reviews → **Add to Google Wallet** opens pay.google.com with the
pass; Save. The JWT's `origins` is the deployment origin, so the link only
works opened from the FieldQuo page — that is Google's rule, not ours.

---

## Files

| What | Where |
|---|---|
| The card page | `app/c/[slug]/page.js` (rows from `lib/links`, the same as the bio link) |
| The vCard, both sizes | `lib/reviews/vcard.js`, served by `app/c/[slug]/contact.vcf/route.js` |
| Sources and tap counts | `lib/reviews/card.js`, `lib/reviews/cardTaps.js`, event `card_tap` in `lib/analytics/product/events.js` |
| QR encoder (no dependency) | `lib/reviews/qr.js`; PNG via sharp in `lib/reviews/qrPng.js` |
| Print sheet | `lib/reviews/printSheet.js`, `app/api/reviews/print-sheet/route.js` |
| Apple pass | `lib/reviews/wallet/applePass.js`, `config.js`, `wwdrG4.js`; route `app/api/reviews/wallet/apple` |
| Google pass | `lib/reviews/wallet/googlePass.js`; route `app/api/reviews/wallet/google` |
| The check | `scripts/check-reviews-google.mjs` — signs a pass against a throwaway identity and verifies manifest and signature |
