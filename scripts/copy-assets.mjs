// Copy everything Eleventy does NOT render into build/: all images, the ZFIN
// legacy pages, and the root files (robots.txt, favicon.ico, analytics.js).
// Excludes the zf_info fragment pages (Eleventy renders those) and the Eleventy
// machinery (_includes, *.11tydata.*). Using a filter instead of extension
// globs handles the extensionless/oddly-named image files under zf_info cleanly.
import { rmSync, mkdirSync } from "node:fs";
import { cp } from "node:fs/promises";
import path from "node:path";

const SRC = "src";
const OUT = "build";

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

await cp(SRC, OUT, {
  recursive: true,
  filter(src) {
    const rel = path.relative(SRC, src);
    if (rel === "") return true;
    if (rel === "_includes" || rel.startsWith("_includes" + path.sep)) return false;
    if (/\.11tydata\.[cm]?js$/.test(rel)) return false;
    // zf_info *.html are Eleventy-rendered, not copied verbatim.
    if (rel.startsWith("zf_info" + path.sep) && rel.endsWith(".html")) return false;
    return true;
  },
});

console.log(`Copied non-templated assets ${SRC}/ -> ${OUT}/`);
