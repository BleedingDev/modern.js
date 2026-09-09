#!/usr/bin/env bash
# Consumers: published ERP-10 and Tractor acceptance, each with its own registry gate.
set -euo pipefail

release_dir="$1"
publish_concurrency="$2"
read_release() {
  node -e 'const fs = require("node:fs"); process.stdout.write(JSON.parse(fs.readFileSync(process.argv[1], "utf8")).release[process.argv[2]])' \
    "$release_dir/manifest.json" "$1"
}
version="${3-$(read_release version)}"
tag="${4-$(read_release tag)}"

for attempt in {1..12}; do
  # A fresh verifier process per attempt cannot reuse stale registry metadata.
  if node "$(dirname "${BASH_SOURCE[0]}")/prepare-bleedingdev-packages.mjs" \
    --publish-existing \
    --dry-run \
    --out "$release_dir" \
    --version "$version" \
    --tag "$tag" \
    --publish-concurrency "$publish_concurrency"; then
    exit 0
  fi
  if [[ "$attempt" == "12" ]]; then
    echo "Exact registry cohort did not become verifiable" >&2
    exit 1
  fi
  sleep 15
done
