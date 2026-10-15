// lib/marketing/founder.js
//
// The founder block on /about (site audit D3.3, 2026-10-15) — the facts that
// are not sentences. The sentences are the owner's draft, in the catalogue
// under about.founder.* in every marketing language.
//
// Each slot below renders nothing while it is EMPTY — the photo and LinkedIn
// profile were supplied by the owner on 2026-10-15; the email is not set —: no grey silhouette, no "LinkedIn" link to a
// profile somebody guessed the address of, no placeholder email. Set the
// value and the slot appears.
//
//   photoUrl     a path under /public (e.g. "/about/emilio-boves.jpg") or an
//                https URL on FieldQuo's own Cloudinary — a photo the owner
//                provided, of the owner.
//   linkedinUrl  the owner's own profile URL, exactly as he gives it.
//   email        an address that reaches him, if he wants one printed.
//
// Facts the text rests on, verified against production on 2026-10-15:
// TrueFinish Cabinets has 130 quotes in FieldQuo; Sunset Space is a FieldQuo
// customer (trialing). The text makes no claim beyond those.
export const FOUNDER = Object.freeze({
  name: "Emilio Boves",
  // The owner's own photo, from the TrueFinish site, approved 2026-10-15
  // (public/founder/emilio-boves.jpg). Its pixel size is here so the page can
  // reserve the box before the image loads — no layout shift.
  photoUrl: "/founder/emilio-boves.jpg",
  photoWidth: 952,
  photoHeight: 1100,
  // Supplied by the owner, 2026-10-15.
  linkedinUrl: "https://www.linkedin.com/in/emilio-boves-285b585b",
  email: null,
});
