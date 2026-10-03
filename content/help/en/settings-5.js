// content/help/en/settings-5.js
//
// settings-business-number — Settings → Business number ("Bring your
// number"). Every control described here was read off
// app/app/settings/business-number/page.js and the routes it calls
// (app/api/settings/business-number/); prices are the ones that screen
// computes (lib/businessNumber/costs.js).
export const ARTICLES = {
  "settings-business-number": {
    title: "Your business number",
    summary:
      "Keep the number your clients already know, and have every call and text on it saved on the lead or job in FieldQuo.",
    updated: "2026-10-03",
    intro: [
      "**Settings → Business number** brings the number on your van and your invoices into FieldQuo. Texts to it arrive in your FieldQuo inbox, linked to the right client, lead or job, and replies go out from it. Only owners and admins see this screen.",
    ],
    sections: [
      {
        id: "which-path",
        heading: "Which way your number comes in",
        blocks: [
          { p: "Type the number and press **Check**. FieldQuo looks up what kind of line it is and shows it as a badge — for example **Cell phone · Bell Mobility** — then offers the one path that kind of line can take." },
          { bullets: [
            "**A cell phone, or an Internet (VoIP) line** — the number moves to FieldQuo. Calls then ring your chosen phones from FieldQuo, and texts land in the inbox.",
            "**A landline or a toll-free number** — calls stay with your phone provider exactly as they are, and only texting moves to FieldQuo.",
            "**Any number outside the US and Canada** — not available yet. The screen says so.",
          ] },
          { note: "A VoIP line has to move rather than keep its calls, because texting on a VoIP line cannot be moved on its own." },
        ],
      },
      {
        id: "move",
        heading: "Moving a cell phone number",
        blocks: [
          { steps: [
            "Fill in the account holder and the service address exactly as they appear on your carrier's bill, your carrier account number and your port-out PIN.",
            "Upload a recent bill (a PDF or a photo, under 4 MB).",
            "Tick the three warnings and sign the authorization by typing your name.",
            "Press **Move my number**. The screen then tracks it: authorization signed, bill uploaded, account number and PIN, and the days spent waiting for your carrier.",
          ] },
          { warning: "Your carrier will text the phone to approve the move. Reply within 90 minutes or the move is cancelled. It takes 5–7 working days, up to 4 weeks, and afterwards the number no longer works on your SIM — get a new number from your carrier for the phone, or cancel that line, and check your contract for cancellation fees first." },
          { tip: "Your PIN and account number are stored encrypted only while the move needs them, and deleted when it finishes. For a US number they go straight to the carrier and are never stored." },
        ],
      },
      {
        id: "texts-only",
        heading: "Moving texts for a landline or toll-free number",
        blocks: [
          { steps: [
            "Fill in the owner's name, an email for the authorization, a phone we can reach you on and the owner's address, then press **Start moving texts**.",
            "When the screen says so, press **Call the number now** and stand by that phone. An automated call asks for the code shown on the screen.",
            "Sign the authorization emailed to you.",
            "The carrier switches texting over, usually within 1–3 working days. Your calls are never affected.",
          ] },
          { note: "If the number can already send texts through another company — a texting app or your provider's business-texting add-on — it can't be moved here. The screen tells you to ask that company to remove texting from the number, then start again." },
        ],
      },
      {
        id: "once-moved",
        heading: "Once it's moved",
        blocks: [
          { bullets: [
            "**Calls ring** — up to three phones you choose ring together. No answer goes to your AI receptionist if you have one switched on, or to voicemail saved on the conversation. Set this under **Where calls ring**.",
            "**Texts** — arrive in the inbox with a phone alert, filed against the client, lead or job; a stranger's first text becomes a lead the same way a Facebook message does.",
            "**Calling out** — press **Call** on a lead, client or job. FieldQuo rings your own phone; press 1 and it rings the client, who sees your business number. Calls are allowed 9:00–20:00 in the client's time, never to someone who asked not to be called, and are not recorded.",
          ] },
        ],
      },
      {
        id: "prices",
        heading: "Prices",
        blocks: [
          { p: "Everything is taken from your phone balance (the one the receptionist uses): $4.00 a month for the number, charged from the day it goes live. Texts from 2¢ each, photos from 5¢, and on a moved number calls from 5¢ a minute (forwarded to you or placed with the Call button). Some carriers are priced higher. Before you start, the screen shows the least a month would come to, from your own last 30 days of texts. FieldQuo charges nothing to move the number." },
        ],
      },
    ],
    faq: [
      { q: "Can I cancel?", a: "Yes, with Cancel this request, until the number is live. Once it is live, contact us to move it away, so your clients are not cut off mid-conversation." },
      { q: "Does this work in a demo account?", a: "The screens work, but nothing is sent to any carrier and no number is ever moved." },
    ],
  },
};
