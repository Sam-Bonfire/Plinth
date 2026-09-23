// Cross-platform contract format check: hurlfmt does not expand globs,
// so enumerate endpoint files here instead of relying on shell expansion.
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "tests", "api", "endpoints");
const files = readdirSync(dir).filter((f) => f.endsWith(".hurl")).sort();

if (files.length === 0) {
  console.error("No contract files found");
  process.exit(1);
}

let failed = false;
for (const file of files) {
  const res = spawnSync("hurlfmt", ["--check", join(dir, file)], { stdio: "inherit" });
  if (res.status !== 0) {
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}
console.log(`Contracts OK (${files.length} files)`);
