// lib/reviews/satisfactionTokens.js
//
// The server-only half of the satisfaction survey: minting tokens and
// building links. Split out of lib/reviews/satisfaction.js specifically
// because THAT file is also imported by app/survey/[token]/SurveyForm.js, a
// "use client" component — bundling `crypto` or `next/headers` into a browser
// build either fails outright or ships a server-only module to the client for
// no reason. Same reasoning as lib/clientPortal.js being separate from
// whatever reads Client.portalToken in a client component.

import { randomBytes } from "crypto";
import { getAppOrigin } from "@/lib/appUrl";
import { MIN_SCORE, MAX_SCORE } from "./satisfaction";

/**
 * 32 bytes of CSPRNG output, base64url — same construction as
 * lib/clientPortal.js's newPortalToken and lib/marketing/unsubscribe.js's
 * newUnsubscribeToken. Unguessable, and unique per row rather than derived
 * from the job or client id, so a leaked token resolves to exactly one job's
 * survey and nothing else.
 */
export function newSurveyToken() {
  return randomBytes(32).toString("base64url");
}

export function surveyUrl(token, request) {
  return `${getAppOrigin(request)}/survey/${token}`;
}

/**
 * A survey link with a score already chosen — what the five tappable numbers
 * in the email point at. Landing here never writes anything (see
 * app/api/survey/[token]/route.js's GET/POST split, same reasoning as the
 * unsubscribe link: an email link-scanner pre-fetching this URL must not be
 * able to cast a vote). The page reads `score` off the querystring purely to
 * pre-select which number is highlighted; the client still has to press Send.
 */
export function surveyUrlWithScore(token, score, request) {
  if (!Number.isInteger(score) || score < MIN_SCORE || score > MAX_SCORE) {
    throw new Error(`surveyUrlWithScore: score must be ${MIN_SCORE}-${MAX_SCORE}, got ${score}`);
  }
  return `${surveyUrl(token, request)}?score=${score}`;
}
