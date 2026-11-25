#!/usr/bin/env bash
# Assembles the GitHub Pages site into OUT (default: site/):
#   OUT/                    main, as players know it
#   OUT/preview/<name>/     every feature/<name> branch, to try at the table
#
# Each preview gets its own saved game and offline cache, because all of them
# share one website with the live version. Run by .github/workflows/pages.yml;
# also works locally after `git fetch`.
set -euo pipefail

out="${1:-site}"
rm -rf "$out"
mkdir -p "$out"

main_ref="$(git rev-parse --verify -q origin/main || echo HEAD)"
git archive "$main_ref" | tar -x -C "$out"

# Replace text in a file, and fail loudly if it isn't there (the code changed).
patch_file() {
  local file="$1" from="$2" to="$3"
  grep -qF -- "$from" "$file" || { echo "build-pages: '$from' not found in $file" >&2; exit 1; }
  FROM="$from" TO="$to" perl -0pi -e 's/\Q$ENV{FROM}\E/$ENV{TO}/g' "$file"
}

for ref in $(git for-each-ref --format='%(refname:short)' 'refs/remotes/origin/feature/'); do
  name="${ref#origin/feature/}"
  name="${name//\//-}"
  dir="$out/preview/$name"
  mkdir -p "$dir"
  git archive "$ref" | tar -x -C "$dir"

  # Own saved game and own offline cache, so the live site and the preview
  # never overwrite or delete each other's data.
  patch_file "$dir/js/state.js" "'ghit:state'" "'ghit-preview-$name:state'"
  patch_file "$dir/sw.js" "ghit-" "preview-$name-"

  # Make it obvious which version is open.
  patch_file "$dir/index.html" "<title>Gloomhaven Initiative Tracker</title>" "<title>Gloomhaven Initiative Tracker (preview: $name)</title>"
  patch_file "$dir/index.html" "<h1>Initiative</h1>" "<h1>Initiative <small style=\"font-size:0.45em;color:var(--muted)\">preview</small></h1>"
  patch_file "$dir/manifest.webmanifest" '"name": "Gloomhaven Initiative Tracker"' "\"name\": \"Gloomhaven Initiative Tracker (preview: $name)\""
  echo "preview: $name"
done
