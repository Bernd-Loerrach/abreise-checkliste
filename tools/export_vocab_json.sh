#!/bin/sh
# Export vokabeln/data.js + conjugations.js to JSON for the native iOS app.
# Writes vokabeln/vocab.json (served online, so the app can fetch new words)
# and native/Portugues/Portugues/vocab.json (bundled into the app).
# Usage (from the repo root):  sh tools/export_vocab_json.sh
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
osascript -l JavaScript - "$ROOT" <<'JXA'
ObjC.import('Foundation');
function run(argv) {
  const root = argv[0];
  const read = (p) => $.NSString.stringWithContentsOfFileEncodingError(root + '/' + p, $.NSUTF8StringEncoding, null).js;
  const json = eval(read('vokabeln/data.js') + '\n' + read('vokabeln/conjugations.js') +
    '\n;JSON.stringify({ decks: DECKS.map(d => ({ id: d.id, icon: d.icon, name: d.name, namePt: d.namePt, cards: d.cards })), conj: CONJ })');
  const obj = JSON.parse(json);
  obj.version = Math.floor(Date.now() / 1000);
  const out = JSON.stringify(obj);
  for (const p of ['vokabeln/vocab.json', 'native/Portugues/Portugues/vocab.json']) {
    $(out).writeToFileAtomicallyEncodingError(root + '/' + p, true, $.NSUTF8StringEncoding, null);
  }
  return obj.decks.length + ' decks, ' + obj.decks.reduce((n, d) => n + d.cards.length, 0) + ' cards, ' + Object.keys(obj.conj).length + ' verbs';
}
JXA
