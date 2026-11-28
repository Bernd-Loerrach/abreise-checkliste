#!/bin/sh
# Publish the web app (vokabeln/) to its own site, https://portuguesvocab.com
# (GitHub project Bernd-Loerrach/portuguesvocab, GitHub Pages from main, root).
# vokabeln/ stays the only copy: this pushes that folder's history as the root of the other project.
# The old address .../abreise-checkliste/vokabeln/ keeps working: build 9 of the app loads vocab2.json there.
# Run after pushing this repo:  sh tools/publish_site.sh
set -e
cd "$(dirname "$0")/.."
rev=$(git subtree split --prefix vokabeln 2>/dev/null)
git push git@github.com:Bernd-Loerrach/portuguesvocab.git "$rev:refs/heads/main"
echo "Published $rev to portuguesvocab.com"
