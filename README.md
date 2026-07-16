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

## Releases (versioned tarballs)

Each release is a versioned tarball of the static content, published as a
GitHub Release. Cut one by pushing a version tag:

```sh
git tag v1.0.0
git push origin v1.0.0
```

`.github/workflows/release.yml` then runs `scripts/make-tarball.sh` and attaches
two assets to the release:

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
scripts/make-tarball.sh v1.0.0   # -> dist/zfin-static-v1.0.0.tar.gz (+ .sha256)
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

_Not yet wired up._
