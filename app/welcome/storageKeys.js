// app/welcome/storageKeys.js
//
// What /signup hands to the welcome screens through this tab's
// sessionStorage — two link facts, nothing the person typed about themselves.
// A separate file so /signup can name the keys without importing the
// welcome screens.

/** The page a signup began from (?next=, an internal path), for after setup. */
export const WELCOME_NEXT_KEY = "fieldquo:welcome-next";

/** A rep's texted-link token (?link=), so the business screen can report "company details". */
export const WELCOME_LINK_KEY = "fieldquo:welcome-link";
