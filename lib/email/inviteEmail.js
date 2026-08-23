// lib/email/inviteEmail.js
// Branded HTML for a team invitation. Kept simple and inline-styled for email
// client compatibility.
//
// ── Why this is translated, and why the role is not capitalised ────────────
//
// The New User page has always had a language picker, and this file took no
// language at all — so an invitation to a Punjabi-speaking framer arrived in
// English whatever was chosen. `invitationLanguage` was stored, copied onto
// the Member on accept, and read by nothing. Recurring failure class #1.
//
// The role was rendered as `role.charAt(0).toUpperCase() + role.slice(1)`,
// which prints the raw enum: "Employee", "Supervisor". The app calls those
// people Worker and Manager. A fourth copy of the role vocabulary, in the
// first thing a new hire ever reads from the company. It uses ROLE_LABELS now,
// like everywhere else.

import { ROLE_LABELS } from "@/lib/permissions/roleManagement";

const COPY = {
  en: {
    heading: (org) => `You're invited to join ${org}`,
    on: "on FieldQuo",
    body: (inviter, org, role) =>
      `${inviter} has invited you to join <strong>${org}</strong> as a <strong>${role}</strong>.`,
    sub: "Click below to set up your login and get started. This invite is tied to your email address.",
    cta: "Accept invitation",
    fallback: "If the button doesn't work, copy and paste this link into your browser:",
    ignore: "If you weren't expecting this, you can ignore this email.",
    member: "team member",
  },
  fr: {
    heading: (org) => `Vous êtes invité à rejoindre ${org}`,
    on: "sur FieldQuo",
    body: (inviter, org, role) =>
      `${inviter} vous invite à rejoindre <strong>${org}</strong> à titre de <strong>${role}</strong>.`,
    sub: "Cliquez ci-dessous pour créer votre accès. Cette invitation est liée à votre adresse courriel.",
    cta: "Accepter l'invitation",
    fallback: "Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :",
    ignore: "Si vous n'attendiez pas ce message, vous pouvez l'ignorer.",
    member: "membre de l'équipe",
  },
  es: {
    heading: (org) => `Le invitamos a unirse a ${org}`,
    on: "en FieldQuo",
    body: (inviter, org, role) =>
      `${inviter} le ha invitado a unirse a <strong>${org}</strong> como <strong>${role}</strong>.`,
    sub: "Haga clic abajo para crear su acceso. Esta invitación está vinculada a su correo electrónico.",
    cta: "Aceptar la invitación",
    fallback: "Si el botón no funciona, copie este enlace en su navegador:",
    ignore: "Si no esperaba este mensaje, puede ignorarlo.",
    member: "miembro del equipo",
  },
  uk: {
    heading: (org) => `Вас запрошують приєднатися до ${org}`,
    on: "у FieldQuo",
    body: (inviter, org, role) =>
      `${inviter} запрошує вас приєднатися до <strong>${org}</strong> як <strong>${role}</strong>.`,
    sub: "Натисніть нижче, щоб створити свій вхід. Це запрошення прив'язане до вашої електронної адреси.",
    cta: "Прийняти запрошення",
    fallback: "Якщо кнопка не працює, скопіюйте це посилання у браузер:",
    ignore: "Якщо ви не очікували цього листа, просто проігноруйте його.",
    member: "учасник команди",
  },
  pa: {
    heading: (org) => `ਤੁਹਾਨੂੰ ${org} ਵਿੱਚ ਸ਼ਾਮਲ ਹੋਣ ਦਾ ਸੱਦਾ ਹੈ`,
    on: "FieldQuo 'ਤੇ",
    body: (inviter, org, role) =>
      `${inviter} ਨੇ ਤੁਹਾਨੂੰ <strong>${org}</strong> ਵਿੱਚ <strong>${role}</strong> ਵਜੋਂ ਸ਼ਾਮਲ ਹੋਣ ਦਾ ਸੱਦਾ ਦਿੱਤਾ ਹੈ।`,
    sub: "ਆਪਣਾ ਲਾਗਇਨ ਬਣਾਉਣ ਲਈ ਹੇਠਾਂ ਕਲਿੱਕ ਕਰੋ। ਇਹ ਸੱਦਾ ਤੁਹਾਡੇ ਈਮੇਲ ਪਤੇ ਨਾਲ ਜੁੜਿਆ ਹੈ।",
    cta: "ਸੱਦਾ ਸਵੀਕਾਰ ਕਰੋ",
    fallback: "ਜੇ ਬਟਨ ਕੰਮ ਨਾ ਕਰੇ, ਤਾਂ ਇਹ ਲਿੰਕ ਆਪਣੇ ਬ੍ਰਾਊਜ਼ਰ ਵਿੱਚ ਪੇਸਟ ਕਰੋ:",
    ignore: "ਜੇ ਤੁਸੀਂ ਇਸ ਦੀ ਉਮੀਦ ਨਹੀਂ ਕਰ ਰਹੇ ਸੀ, ਤਾਂ ਇਸ ਈਮੇਲ ਨੂੰ ਅਣਡਿੱਠਾ ਕਰ ਸਕਦੇ ਹੋ।",
    member: "ਟੀਮ ਮੈਂਬਰ",
  },
  tl: {
    heading: (org) => `Inaanyayahan kang sumali sa ${org}`,
    on: "sa FieldQuo",
    body: (inviter, org, role) =>
      `Inanyayahan ka ni ${inviter} na sumali sa <strong>${org}</strong> bilang <strong>${role}</strong>.`,
    sub: "I-click sa ibaba para gawin ang iyong login. Nakatali ang imbitasyong ito sa iyong email address.",
    cta: "Tanggapin ang imbitasyon",
    fallback: "Kung hindi gumana ang button, kopyahin ang link na ito sa iyong browser:",
    ignore: "Kung hindi mo ito inaasahan, puwede mong balewalain ang email na ito.",
    member: "miyembro ng team",
  },
};

/** The copy for a language, falling back to English for anything unknown. */
export function inviteCopy(language) {
  return COPY[String(language || "en").toLowerCase()] || COPY.en;
}

export function inviteEmailHTML({ orgName, inviterName, role, acceptUrl, language = "en" }) {
  const c = inviteCopy(language);
  // ROLE_LABELS, not a capitalised enum — the app calls these people Worker
  // and Manager, and this email is the first thing they read from the company.
  const roleLabel = role ? ROLE_LABELS[role] || role : c.member;
  return `
  <!DOCTYPE html>
  <html>
    <head><meta charset="utf-8" /></head>
    <body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;">
      <div style="max-width:560px;margin:0 auto;padding:0;">
        <div style="background:#111827;color:#ffffff;padding:32px 30px;text-align:center;">
          <h1 style="margin:0;font-size:22px;font-weight:700;">${c.heading(orgName)}</h1>
          <p style="margin:8px 0 0 0;opacity:0.85;font-size:14px;">${c.on}</p>
        </div>
        <div style="background:#ffffff;padding:32px 30px;">
          <p style="font-size:15px;line-height:1.7;margin:0 0 16px 0;">
            ${c.body(inviterName, orgName, roleLabel)}
          </p>
          <p style="font-size:14px;line-height:1.7;color:#4b5563;margin:0 0 28px 0;">
            ${c.sub}
          </p>
          <div style="text-align:center;margin:0 0 28px 0;">
            <a href="${acceptUrl}"
              style="display:inline-block;padding:14px 36px;background:#111827;color:#ffffff !important;
                     text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;">
              ${c.cta}
            </a>
          </div>
          <p style="font-size:12px;color:#9ca3af;line-height:1.6;margin:0;">
            ${c.fallback}<br/>
            <a href="${acceptUrl}" style="color:#6b7280;">${acceptUrl}</a>
          </p>
        </div>
        <div style="text-align:center;padding:20px;color:#9ca3af;font-size:12px;">
          <p style="margin:0;">${c.ignore}</p>
        </div>
      </div>
    </body>
  </html>`;
}
