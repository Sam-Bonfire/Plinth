// Daily supply-chain gate: fails on high/critical advisories except those
// in .github/security-audit-allowlist.json (each entry needs a reason and
// expires when a patched release ships; the entry is re-checked every run).
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const allowlist = JSON.parse(
  readFileSync(new URL("../.github/security-audit-allowlist.json", import.meta.url)),
);

let raw;
try {
  raw = execFileSync("pnpm", ["audit", "--json"], { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] });
} catch (err) {
  raw = err.stdout ?? "{}";
}
const advisories = Object.values(JSON.parse(raw).advisories ?? {});
const blocking = advisories.filter((a) => ["high", "critical"].includes(a.severity));

const open = blocking.filter((a) => {
  const id = a.url?.split("/").pop();
  return !allowlist.some((e) => e.ghsa === id && e.module === a.module_name);
});

for (const a of open) {
  console.error(`${a.severity}: ${a.module_name} ${a.vulnerable_versions} (${a.url})`);
}
if (open.length > 0) {
  console.error(`${open.length} unallowlisted high/critical advisories`);
  process.exit(1);
}
console.log("Supply chain OK: no unallowlisted high/critical advisories");
