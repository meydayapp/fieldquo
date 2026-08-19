// lib/auth.js
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { organization } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";

import { db } from "./db";
import { sendTeamInviteEmail } from "./email/teamInvite";

export const auth = betterAuth({
  database: prismaAdapter(db, {
    provider: "postgresql",
  }),

  emailAndPassword: {
    enabled: true,
  },

  plugins: [
    organization({
      creatorRole: "owner",

      schema: {
        member: {
          modelName: "OrgMember",
        },
      },

      // Actually deliver the invite. Without this, createInvitation only wrote
      // a DB row and no email ever went out. `data` carries the invitation id,
      // email, role, the organization, and the inviter.
      //
      // The body of it lives in lib/email/teamInvite.js, for two reasons that
      // are documented at length there: the From address has to be RESOLVED
      // (this hook used to let sendEmail fall back to Resend's sandbox
      // address, which silently delivers to nobody), and Better Auth swallows
      // whatever this hook throws — so the outcome has to be left somewhere
      // the API route can pick it up and report.
      async sendInvitationEmail(data, request) {
        await sendTeamInviteEmail({
          invitationId: data.id || data.invitation?.id,
          email: data.email,
          organizationId:
            data.organization?.id || data.invitation?.organizationId,
          orgName: data.organization?.name,
          inviterName: data.inviter?.user?.name || data.inviter?.name,
          role: data.role,
          request,
        });
      },
    }),

    // Keep this as the final plugin.
    nextCookies(),
  ],

  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
});
