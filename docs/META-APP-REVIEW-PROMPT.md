# Prompt for Claude in Chrome — Meta App Review for FieldQuo

Paste everything below the line into Claude in Chrome while signed in to developers.facebook.com and business.facebook.com as the FieldQuo admin. It stops before every submit button and asks you.

---

You are helping me submit a Meta App Review for FieldQuo. I am signed in to developers.facebook.com and business.facebook.com. Work step by step, and STOP and ask me before clicking any button labelled Submit, Save, Create, Confirm, Publish or Request. Never type a password, card, or government ID; if a screen asks for one, hand it back to me. Read each page before acting and tell me what you see.

## Facts about FieldQuo (use these verbatim where asked)

- Legal business name: FieldQuo Inc. (Canada). Website: https://www.fieldquo.com. Support email: the address I give you when asked — do not invent one.
- FieldQuo is software for field-service contractors (painters, cabinet makers, flooring installers, plumbers, landscapers) to quote, schedule, invoice and get paid.
- The Meta integration is READ-ONLY. It requests exactly one permission: `ads_read`. It never requests `ads_management`, never creates, edits or pauses a campaign, and does not use Facebook Login (FieldQuo signs users in with email and password only).
- Data deletion instructions URL: https://www.fieldquo.com/data-deletion. Privacy policy URL: https://www.fieldquo.com/privacy. Terms URL: https://www.fieldquo.com/terms. (If any of these 404s, tell me and stop.)
- App icon: I will upload the 1024×1024 PNG myself when you reach that field; tell me when.

## The written use case (paste verbatim into the use-case / "how will you use this permission" field)

"FieldQuo is software that field-service contractors (painters, cabinet makers, flooring installers, plumbers, landscapers) use to run their business. A contractor who advertises on Meta connects their own ad account so their ad spend and campaign performance appear alongside their other business numbers inside FieldQuo, next to the leads and jobs that spend produced. FieldQuo only reads — it requests ads_read and nothing else — and never creates, edits, pauses or targets a campaign. Each contractor connects only their own ad account through Meta's OAuth dialog and can disconnect at any time from FieldQuo's settings, which deletes the stored token immediately."

## Steps

1. Open https://developers.facebook.com/apps/. Tell me whether an app for FieldQuo already exists. If not, go to Create App → type "Business" → name "FieldQuo" → attach the FieldQuo Business portfolio → stop before Create and ask me.
2. In the app, add the product "Marketing API" if it is not already added.
3. App Settings → Basic: fill Display name "FieldQuo", Contact email (ask me), Privacy Policy URL, Terms of Service URL, User data deletion → "Data deletion instructions URL" with the URL above, Category "Business and pages", App icon (tell me when to upload). Stop before Save and read the whole form back to me.
4. App Review → Permissions and features: find `ads_read` and click "Request advanced access". For the form: paste the use case above; where it asks for a screen recording, tell me and stop — I will record it myself (the flow is: FieldQuo Settings → Marketing → "Connect Meta Ads" → Meta's OAuth dialog → approve → back in FieldQuo showing spend). Where it asks for test credentials, tell me and stop.
5. Business Verification: open Business Settings → Security Center. Tell me the verification status. If it says "Not verified", start verification with legal name "FieldQuo Inc." and stop at the document upload — I will upload the documents myself.
6. Before anything is submitted, give me a checklist of every field you filled and every field left for me, then wait.

If Meta shows an error, a policy notice, or asks for something not on this list, quote it to me exactly and stop.
