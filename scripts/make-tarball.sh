#!/usr/bin/env bash
#
# Build a versioned tarball of the served static content (src/).
#
# The tarball's top-level entries are the DocumentRoot contents themselves
# (zf_info/, images/, ZFIN/, robots.txt, favicon.ico, analytics.js) -- NOT a
# src/ wrapper -- so it extracts straight into the Apache DocumentRoot:
#
#     tar -xzf zfin-static-<version>.tar.gz -C "$TARGETROOT/home"
#
# Usage: scripts/make-tarball.sh [version]
#   version defaults to `git describe --tags --always --dirty`, else "dev".
#
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

version="${1:-$(git describe --tags --always --dirty 2>/dev/null || echo dev)}"
outdir="dist"
name="zfin-static-${version}.tar.gz"
tarball="$outdir/$name"

mkdir -p "$outdir"

# Contents of src/ at the tarball root (DocumentRoot layout).
tar -czf "$tarball" -C src .

# Integrity checksum alongside (Linux: sha256sum, macOS: shasum).
if command -v sha256sum >/dev/null 2>&1; then
  ( cd "$outdir" && sha256sum "$name" > "$name.sha256" )
else
  ( cd "$outdir" && shasum -a 256 "$name" > "$name.sha256" )
fi

echo "Built $tarball"
echo "      $(cat "$tarball.sha256")"
