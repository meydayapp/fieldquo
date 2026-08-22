import "dotenv/config";
import { db } from "./lib/db.js";
const rows = await db.platformFeature.findMany({ orderBy: { key: "asc" } });
console.log("PlatformFeature rows set in production:", rows.length);
rows.forEach(r => console.log(`  ${r.key.padEnd(22)} ${r.state}${r.note ? "  — " + r.note : ""}`));
const ov = await db.companyFeatureOverride.findMany({ select: { key: true, state: true, company: { select: { name: true } } } });
console.log("per-company overrides:", ov.length);
ov.forEach(o => console.log(`  ${o.company.name} → ${o.key} = ${o.state}`));
await db.$disconnect();
