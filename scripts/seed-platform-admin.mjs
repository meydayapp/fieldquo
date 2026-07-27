// scripts/seed-platform-admin.mjs
//
// Creates the FIRST platform admin. Everything else in /platform requires an
// authenticated admin — including /api/platform/admins, which is how you'd
// normally create one — so without this there is no way in. Chicken and egg.
//
//   npx tsx scripts/seed-platform-admin.mjs you@fieldquo.com
//
// Prompts for a password rather than taking it as an argument, so it doesn't
// end up in your shell history. Re-running for an existing email resets that
// admin's password instead of erroring, which doubles as password recovery
// (there's no reset-by-email flow for platform accounts, deliberately —
// fewer ways into an account that can read every tenant's data).

import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// Prisma 7 requires a driver adapter — `new PrismaClient()` with no options
// throws. Mirrors lib/db.js rather than importing it, because that module
// memoises a client on globalThis for Next's dev server and a one-shot script
// wants its own connection it can cleanly close.
//
// dotenv/config is imported first so DATABASE_URL is populated before the
// Pool is constructed; without it the connection string is undefined and the
// failure is a confusing timeout rather than a clear error.
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL isn't set. Check your .env.");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

const email = (process.argv[2] || "").trim().toLowerCase();

if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error("Usage: npx tsx scripts/seed-platform-admin.mjs <email>");
  process.exit(1);
}

const rl = createInterface({ input: stdin, output: stdout });

// Node has no built-in silent prompt. Muting the output stream while the
// password is typed is the standard workaround — without it the password is
// echoed to the terminal and lands in scrollback.
async function askHidden(question) {
  stdout.write(question);
  const wasMuted = rl.output.muted;
  rl.output.muted = true;

  const originalWrite = rl.output.write.bind(rl.output);
  rl.output.write = (chunk, ...rest) => {
    if (rl.output.muted) return true;
    return originalWrite(chunk, ...rest);
  };

  const answer = await rl.question("");
  rl.output.write = originalWrite;
  rl.output.muted = wasMuted;
  stdout.write("\n");
  return answer;
}

try {
  const password = await askHidden("Password: ");
  const confirm = await askHidden("Confirm password: ");

  if (password !== confirm) {
    console.error("Passwords don't match.");
    process.exit(1);
  }
  if (password.length < 12) {
    // This account can read every tenant's data and impersonate any company.
    // A short password here is not a small problem.
    console.error("Use at least 12 characters — this account sees everything.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const existing = await db.platformAdmin.findUnique({ where: { email } });

  const admin = existing
    ? await db.platformAdmin.update({
        where: { email },
        data: { passwordHash, active: true },
      })
    : await db.platformAdmin.create({
        data: { email, passwordHash, role: "superadmin", active: true },
      });

  console.log(
    existing
      ? `Reset password for ${admin.email} (role: ${admin.role}).`
      : `Created superadmin ${admin.email}.`,
  );
  console.log("Sign in at /platform/login");
} finally {
  rl.close();
  await db.$disconnect();
  await pool.end();
}
