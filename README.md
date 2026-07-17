# zfin-static

Standalone repository for ZFIN's **served static content** — the archival
`zf_info` reference pages (zfbook, monitor, anatomy, catch, news, dbase/PAPERS,
sequence, stars, and misc single pages) plus their images and site assets.

This content used to live in the main `zfin.org` repo under `static/` and be
rendered through JSP/Tomcat via `StaticFileController`. It is now plain static
HTML served directly off the Apache DocumentRoot. This repo exists so the
archival content can be versioned and deployed **independently** of the main app.

> **Status:** released as versioned tarballs (latest **v1.1.0**) and deploy-verified
> end-to-end in a dev stack — served via the main app (see Deploy); prod rollout
> pends the main-repo `static-file-refactor` branch merge. These pages are not
> standalone; see the Coupling contract below.

## Layout

Source lives under `src/`; a build step renders it into `build/` (the served
tree). The `zf_info` reference pages are authored as **fragments** — YAML front
matter (just a `title`) plus the page body — and Eleventy wraps each in the
shared shell (`src/_includes/layout.njk`). Everything else is served verbatim.

```
src/
  _includes/layout.njk        the one shell (head, chrome mounts, <main>) — edit once
  zf_info/                    reference-page fragments (+ their inline images)
    zf_info.11tydata.js       applies the layout; keeps output path == source path
    toc/*.json                RWPM-subset navigation manifests (served at /zf_info/toc/)
  images/                     shared site images
  ZFIN/                       legacy pages (different shell — copied verbatim, not templated)
  robots.txt
  favicon.ico
  analytics.js                self-contained, host-switched GA4 loader
eleventy.config.js            renders only zf_info/*.html; ignores ZFIN/
scripts/copy-assets.mjs       copies all non-templated files into build/
scripts/package.mjs           tars build/ + writes .sha256
```

A page fragment looks like:

```html
---
title: ZFIN Zebrafish Nomenclature
---
<div> ...the page body that goes inside <main>... </div>
```

`build/` maps 1:1 onto the deployed static volume (`/opt/zfin/static`), and each
entry is symlinked into the Apache DocumentRoot (see Deploy). The render is
byte-for-byte faithful — `build/` reproduces the previously-served pages exactly.

## Build

```sh
npm ci
npm run build      # build:assets (copy) + build:pages (Eleventy) -> build/
npm run package    # -> dist/zfin-static-<version>.tar.gz (+ .sha256)
```

To change the shell across all ~388 pages (e.g. a `<head>` tag, or the no-JS
nav/skip-link — now baked into the layout), edit `src/_includes/layout.njk` once
and rebuild.

## Navigation TOCs

`src/zf_info/toc/` holds one ordered navigation manifest per collection plus a
`list-of-tocs.json` index — the data behind the client-side page nav (the
`booknav.js` prev/next bar and the `fulltoc.html` full index). Apache serves it
at **`/zf_info/toc/*.json`** so the nav can `fetch` it.

Each `<collection>.json` is a subset of the **Readium Web Publication Manifest**
([RWPM](https://readium.org/webpub-manifest/)), so the fields follow an
established standard:

- `metadata` — `{title, identifier}` (plus `description` on the hand-authored files)
- `links` — the source contents page, `[{rel: "contents", href}]` (omitted where
  there is none)
- `readingOrder` — the ordered, de-duplicated page sequence `[{href, title}]`
  (drives prev/next)
- `toc` — the same pages grouped by heading, `[{title, children: [{href, title}]}]`
- `coverage` — non-standard extension: `readingOrderPages` vs `collectionHtmlPages`

`list-of-tocs.json` is a hand-maintained index of those files (which collections
exist, in what order, and the path prefixes that map a page to its collection);
it is **not** itself RWPM (RWPM has no list-of-publications concept).

The four generated collections (`zfbook` 80, `staging` 63, `monitor` 93,
`anatomy` 79) were produced by a `build-toc.py` parser that walked each
collection's contents page — reading `<a href>` and (for anatomy) `<area href>`
image maps, recursing into per-section sub-indexes. `loose.json` and `misc.json`
are hand-authored, since those pages have no single ordered index. The parser
lived in a `toctools/` scratch dir that has since been removed; **recover it from
git history** (`toctools/build-toc.py`) if the manifests ever need regenerating.

## Provenance

Pages were converted from the former JSP views on the `zfin.org`
`static-file-refactor` branch by a one-shot `convert-zfbook-to-static.groovy`
script (since removed from that repo; recoverable from its git history),
imported here at `af51282a9e69257595bc53716e54c8b00a5976a5`, then de-duplicated
into fragments + a shared Eleventy layout.

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

## Releases (versioned tarballs)

Each release is a versioned tarball of the static content, published as a
GitHub Release. Cut one by pushing a version tag:

```sh
git tag v1.0.0
git push origin v1.0.0
```

`.github/workflows/release.yml` then runs `npm ci && npm run build && npm run
package` and attaches two assets to the release:

- `zfin-static-<version>.tar.gz` — the tarball
- `zfin-static-<version>.tar.gz.sha256` — its checksum

The tarball's top-level entries are the served paths themselves (`zf_info/`,
`images/`, `ZFIN/`, `robots.txt`, `favicon.ico`, `analytics.js`), with no `src/`
wrapper, so it extracts straight onto the static volume:

```sh
tar -xzf zfin-static-v1.0.0.tar.gz -C /opt/zfin/static
```

Build one locally the same way CI does:

```sh
npm run build && npm run package v1.0.0   # -> dist/zfin-static-v1.0.0.tar.gz (+ .sha256)
```

## Deploy (separate volume + docroot symlinks)

The content is served from its **own volume** (`/opt/zfin/static`), separate
from the app's Apache DocumentRoot (`$TARGETROOT/home`). The main repo's
`home;static;deployFromRelease` Gradle task (run as part of `make`) does the
deploy:

1. Download the pinned release tarball and verify its `.sha256`.
2. **Wipe-first extract** into `/opt/zfin/static` — the volume is exclusively
   owned by this repo, so clearing it before extraction cleanly drops files
   removed upstream (no app output or instance state to protect).
3. Symlink each top-level entry into the DocumentRoot
   (`$TARGETROOT/home/zf_info -> /opt/zfin/static/zf_info`, etc.).

Apache serves the symlinked paths as ordinary static files — the httpd
container mounts `/opt/zfin/static` and `docker/httpd/conf-local` grants
`<Directory /opt/zfin/static>` with `FollowSymLinks`. A version stamp at
`/opt/zfin/static/.zfin-static-version` makes the step idempotent; bump the
pinned version to roll forward or back.

**Ownership is now by volume, not by subtree:** this repo owns all of
`/opt/zfin/static`; the app owns `$TARGETROOT/home` (its `dist/`, `gwt/`,
`schemaSpy/`, `asset-manifest.json`, etc.). The only thing the app places in the
docroot on this repo's behalf are the symlinks. No shared directory, no clobber
risk.

**Wired up + verified.** The `home;static;deployFromRelease` task exists in the
main repo and was verified end-to-end in a dev stack (root files + zf_info serve
statically through the symlinks; login/logout, caching, and the no-JS nav all
exercised). An instance picks up this content when its main-repo build pins a
release via `zfinStaticVersion` (currently pinned to a v1.x release). One
provisioning note: `/opt/zfin/static` must be owned by the deploy user — the base
image pre-creates it (see the main repo's `docker/base/Dockerfile`).
