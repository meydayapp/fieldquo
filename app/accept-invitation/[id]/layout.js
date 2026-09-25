// app/accept-invitation/[id]/layout.js
//
// The invitation page in the language the invitation EMAIL was written in —
// PendingTeamProfile.invitationLanguage, English when the inviter chose none,
// exactly as lib/email/teamInvite.js decides it (lib/authLinkLanguage.js).
//
// A layout rather than a wrapper page because the answer comes from the
// invitation id in the PATH, which a layout receives; the page itself is left
// untouched. Keyed on the id, it is right for invitations already sitting in
// inboxes too — nothing had to be added to the link.
import LinkLanguage from "@/app/components/auth/LinkLanguage";
import { invitationArrivalLanguage } from "@/lib/authLinkLanguage";

export const dynamic = "force-dynamic";

export default async function AcceptInvitationLayout({ children, params }) {
  // Next 16: a Promise.
  const { id } = await params;
  const language = await invitationArrivalLanguage(id);
  return <LinkLanguage language={language}>{children}</LinkLanguage>;
}
