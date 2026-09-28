// lib/meta/whatsappPanelState.js
//
// What the WhatsApp panel (app/components/settings/WhatsAppPanel.js) draws,
// as a pure function of what /api/settings/whatsapp/status returned.
//
// Pulled out of the component so the one rule the panel exists to keep — no
// Connect button a company cannot use — is EXECUTED by
// scripts/check-whatsapp.mjs against the status route's real output, flag off
// and on, staff and not, rather than read off JSX with a regex. No imports:
// the panel is a client component, and this must stay importable there and
// from a bare Node check script.
//
// Fails closed. A status with no `doors` (a response from before they
// existed, or a malformed one) reads as "no door for this viewer", which is
// the coming-soon sentence — never a Connect button nobody vouched for.

/**
 * @param status  the JSON /api/settings/whatsapp/status returned, or null
 */
export function whatsAppPanelState(status) {
  const doors = status?.doors || {};
  const signupDoor = doors.signup === true;
  const manualDoor = doors.manual === true;
  const channels = Array.isArray(status?.channels) ? status.channels : [];
  const hasChannels = channels.length > 0;

  const connectEnabled = status?.connectEnabled === true;
  const fullyConfigured = status?.fullyConfigured === true;
  const signupConfigured = status?.signupConfigured === true;

  // No door at all → the one sentence. A number connected earlier is still
  // drawn (with its Disconnect) below it — the sentence replaces the ways IN,
  // never a working connection.
  const comingSoon = Boolean(status) && !signupDoor && !manualDoor;
  const live = Boolean(status) && !comingSoon;

  const canConnect = signupDoor && connectEnabled && fullyConfigured && signupConfigured;
  // The pasted-credential door needs the flag and the credentials, but NOT
  // the Embedded Signup configuration — that is the one thing it exists to
  // do without. Withheld under a support session: the route would refuse the
  // POST (non-negotiable #3), and a form that would be refused is not drawn.
  const canManual = manualDoor && connectEnabled && fullyConfigured && status?.readOnly !== true;

  const showNoSignupConfig = live && connectEnabled && fullyConfigured && !signupConfigured;
  const showConnectCard = canConnect && !hasChannels;
  const manualInNoSignupCard = showNoSignupConfig && canManual && !hasChannels;
  const manualInConnectCard = showConnectCard && canManual;

  // The staff label goes on the card when the Connect button itself is there
  // only because the viewer is staff (it then covers the advanced block in
  // the same card too); otherwise on the advanced block alone, which is
  // staff-only even after Meta approves.
  const connectCardStaffLabel = showConnectCard && doors.signupStaffOnly === true;
  const manualStaffLabel = (manualInNoSignupCard || manualInConnectCard) && !connectCardStaffLabel;

  // The coming-soon sentence's second half names only the inboxes the status
  // route saw connected. Neither → no second half; never a padded claim.
  const inbox = Array.isArray(status?.inboxPlatforms) ? status.inboxPlatforms : [];
  const fb = inbox.includes("facebook");
  const ig = inbox.includes("instagram");
  const comingSoonInboxKey =
    fb && ig
      ? "app.setWhatsApp.comingSoonInboxBoth"
      : fb
        ? "app.setWhatsApp.comingSoonInboxFacebook"
        : ig
          ? "app.setWhatsApp.comingSoonInboxInstagram"
          : null;

  return {
    comingSoon: comingSoon && !hasChannels,
    comingSoonInboxKey,
    showAwaiting: live && !connectEnabled,
    showNotConfigured: live && connectEnabled && !fullyConfigured,
    showNoSignupConfig,
    showConnectCard,
    manualInNoSignupCard,
    manualInConnectCard,
    connectCardStaffLabel,
    manualStaffLabel,
  };
}
