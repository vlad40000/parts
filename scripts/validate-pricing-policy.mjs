import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const forbidden = [
  'pricingSource: "sears"',
  'pricingSource: "partselect"',
  'pricingSource: "partsdr"',
  "pricing_source = 'sears'",
  "pricing_source = 'partselect'"
];
const skip = new Set(["node_modules", ".next", ".git"]);

function walk(dir) {
  const out = [];
  for (const item of readdirSync(dir)) {
    if (skip.has(item)) continue;
    const path = join(dir, item);
    const stat = statSync(path);
    if (stat.isDirectory()) out.push(...walk(path));
    else if (/\.(ts|tsx|js|mjs|sql|md)$/.test(path)) out.push(path);
  }
  return out;
}

const hits = [];
for (const file of walk(root)) {
  if (file.endsWith("validate-pricing-policy.mjs")) continue;
  const text = readFileSync(file, "utf8");
  for (const term of forbidden) {
    if (text.includes(term)) hits.push(`${file}: ${term}`);
  }
}

if (hits.length) {
  console.error("Unauthorized normalized pricing source patterns found:");
  for (const hit of hits) console.error(`- ${hit}`);
  process.exit(1);
}

console.log("Pricing policy scan passed.");
