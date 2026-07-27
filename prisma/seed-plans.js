// prisma/seed-plans.js
import "dotenv/config";
import { db } from "../lib/db.js";
import { calculatePricing } from "../lib/pricing.js";

const NAMED_TIERS = [
  { name: "1 Employee", employeeCount: 1 },
  { name: "10 Employees", employeeCount: 10 },
  { name: "20 Employees", employeeCount: 20 },
];

async function main() {
  for (const tier of NAMED_TIERS) {
    const pricing = calculatePricing(tier.employeeCount);

    await db.plan.upsert({
      where: { name: tier.name },
      update: {
        priceMonthly: pricing.monthlyTotal,
        maxUsers: tier.employeeCount,
      },
      create: {
        name: tier.name,
        priceMonthly: pricing.monthlyTotal,
        maxUsers: tier.employeeCount,
        aiCopilotEnabled: tier.employeeCount >= 10,
      },
    });
  }

  console.log("Seeded 3 pricing plans.");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
