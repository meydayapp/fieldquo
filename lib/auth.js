// lib/auth.js
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { organization } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";

import { db } from "./db";
import { sendEmail } from "./email/resend";
import { inviteEmailHTML } from "./email/inviteEmail";

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
      async sendInvitationEmail(data) {
        const inviteId = data.id || data.invitation?.id;
        const appUrl =
          process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || "";
        const acceptUrl = `${appUrl}/accept-invitation/${inviteId}`;
        const orgName = data.organization?.name || "the team";
        const inviterName =
          data.inviter?.user?.name || data.inviter?.name || "A teammate";

        await sendEmail({
          to: data.email,
          subject: `You're invited to join ${orgName} on FieldQuo`,
          html: inviteEmailHTML({
            orgName,
            inviterName,
            role: data.role,
            acceptUrl,
          }),
        });
      },
    }),

    // Keep this as the final plugin.
    nextCookies(),
  ],

  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
});
