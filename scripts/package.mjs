// Build the versioned release tarball from build/ (the rendered site), plus a
// .sha256. The tarball's top-level entries are the served paths themselves
// (zf_info/, images/, ZFIN/, robots.txt, favicon.ico, analytics.js), so it
// extracts straight onto the /opt/zfin/static volume.
//
// Usage: node scripts/package.mjs [version]
//   version defaults to `git describe --tags --always --dirty`, else "dev".
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";

if (!existsSync("build")) {
  console.error("build/ not found -- run `npm run build` first.");
  process.exit(1);
}

let version = process.argv[2] || process.env.VERSION;
if (!version) {
  try {
    version = execFileSync("git", ["describe", "--tags", "--always", "--dirty"]).toString().trim();
  } catch {
    version = "dev";
  }
}

mkdirSync("dist", { recursive: true });
const name = `zfin-static-${version}.tar.gz`;
const tarball = `dist/${name}`;

// Contents of build/ at the tarball root (DocumentRoot / static-volume layout).
execFileSync("tar", ["-czf", tarball, "-C", "build", "."], { stdio: "inherit" });

const hash = createHash("sha256").update(readFileSync(tarball)).digest("hex");
writeFileSync(`${tarball}.sha256`, `${hash}  ${name}\n`);

console.log(`Built ${tarball}`);
console.log(`      ${hash}`);
