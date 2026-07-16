// Applies to every page under src/zf_info: wrap in the shared layout, and keep
// the output path identical to the source path (…/foo.html -> …/foo.html, not
// Eleventy's default …/foo/index.html) so served URLs are unchanged.
export default {
  layout: "layout.njk",
  eleventyComputed: {
    permalink: (data) => `${data.page.filePathStem}.html`,
  },
};
