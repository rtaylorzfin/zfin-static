# zfin-static

Standalone repository for ZFIN's **served static content** — the archival
`zf_info` reference pages (zfbook, monitor, anatomy, catch, news, dbase/PAPERS,
sequence, stars, and misc single pages) plus their images and site assets.

This content used to live in the main `zfin.org` repo under `static/` and be
rendered through JSP/Tomcat via `StaticFileController`. It is now plain static
HTML served directly off the Apache DocumentRoot. This repo exists so the
archival content can be versioned and deployed **independently** of the main app.

> **Status: experiment.** Initial import only. See "Coupling contract" below —
> these pages are not standalone; they depend on the main app at runtime.

## Layout

Everything served lives under `src/`, mirroring the deployed DocumentRoot layout:

```
src/
  zf_info/      reference pages (~961 files: HTML + inline images)
  images/       shared site images (~83)
  ZFIN/         legacy ZFIN assets (~23)
  robots.txt
  favicon.ico
  analytics.js  self-contained, host-switched GA4 loader
```

`src/` maps 1:1 onto `$TARGETROOT/home/` on the server (the Apache
DocumentRoot on the `www_data` volume). Deploy = land `src/*` there.

## Provenance

Imported from the `zfin.org` `static-file-refactor` branch at
`af51282a9e69257595bc53716e54c8b00a5976a5` (the `static/` tree, flattened to
`src/`). The one-shot JSP→HTML converter that produced these pages
(`convert-zfbook-to-static.groovy`) remains in the main repo.

## Coupling contract (do not break without coordinating the main repo)

The pages are **not** self-contained. At runtime, from the same origin, they
require the main `zfin.org` app to keep serving:

- `/dist/style.latest.css`, `/dist/vendor-common.latest.js`,
  `/dist/zfin-common.latest.js` — stable webpack `.latest` aliases (not
  content-hashed), referenced by every page.
- `/action/layout/header` and `/action/layout/footer` — Tomcat/`ChromeController`
  fragments injected client-side by `zfin-chrome.js`. The header is login-aware,
  which is why it is fetched at runtime rather than baked in.

`analytics.js` is the exception: it is fully self-contained (picks the GA4 id
from `window.location.hostname`) and carries no build-time substitution.

Keep those alias names and endpoints stable, or coordinate the change across
both repos.

## Deploy (planned — Option 1 from the main repo's design note)

A lightweight CI job checks out this repo and `rsync`s `src/` into
`$TARGETROOT/home/`, triggered by this repo's webhook. Independent cadence,
**zero Apache changes** — the files just land where Apache already serves from.

The two pipelines write to the same `$TARGETROOT/home` but to **disjoint
subtrees**: the main app owns `/dist`, `WEB-INF`, etc.; this repo owns
`zf_info/`, `images/`, `ZFIN/`, and the root assets. They must never clobber
each other.

_Not yet wired up._
