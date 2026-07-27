// scripts/debug-user.js
import "dotenv/config";
import { db } from "../lib/db.js";

const userId = "J2LoEm44ErhRHTKTCUveTCpoILhCHdsj";

async function main() {
  const user = await db.user.findUnique({ where: { id: userId } });
  const members = await db.member.findMany({ where: { userId } });
  const companies = await db.company.findMany({
    where: { authOrgId: { not: null } },
  });

  console.log("User exists:", !!user, user);
  console.log("Member rows for this user:", members.length, members);
  console.log(
    "All companies with an authOrgId set:",
    companies.length,
    companies,
  );
}

main().finally(() => db.$disconnect());
