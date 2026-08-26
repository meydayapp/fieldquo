import { createAuthClient } from "better-auth/react";
import { organizationClient, twoFactorClient } from "better-auth/client/plugins";

const c = createAuthClient({
  baseURL: "http://localhost:3000",
  plugins: [organizationClient(), twoFactorClient()],
});
for (const k of ["requestPasswordReset", "forgetPassword", "resetPassword", "sendVerificationEmail", "verifyEmail", "twoFactor", "signIn", "organization"]) {
  console.log(k, "->", typeof c[k]);
}
console.log("twoFactor keys:", c.twoFactor && Object.keys(c.twoFactor));
