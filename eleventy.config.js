// Eleventy renders ONLY the zf_info reference pages: each src/zf_info/**/*.html
// is a fragment (YAML front matter with `title` + the <main> body) wrapped by
// src/_includes/layout.njk into the full shell. Everything else (images, the
// ZFIN legacy pages, root files) is copied verbatim by scripts/copy-assets.mjs
// (npm run build:assets) -- that copy step, not Eleventy, owns those files, so
// odd/extensionless asset names are handled without per-extension globs.
export default function (eleventyConfig) {
  eleventyConfig.setTemplateFormats(["html"]);
  // ZFIN pages use a different (non-chrome) shell -- don't template them.
  eleventyConfig.ignores.add("src/ZFIN/**");
  return {
    // Page bodies are raw HTML fragments; only the layout is templated (njk).
    htmlTemplateEngine: false,
    dir: { input: "src", includes: "_includes", output: "build" },
  };
}
