# Português – native iPhone / iPad / Mac app

SwiftUI version of the vocabulary trainer in `../vokabeln/` (same words, same
learning logic, same progress-file format).

* Open `Portugues/Portugues.xcodeproj` in Xcode and press ▶ (iPhone simulator or your own device).
* Words: `Portugues/Portugues/vocab.json`, generated from the web app's `data.js` +
  `conjugations.js` by `sh tools/export_vocab_json.sh` (run from the repo root after adding words).
  The same file is published at `vokabeln/vocab.json`; the app downloads it on launch,
  so new words reach the app without an App Store update.
* iCloud sync is coded (`ProgressStore.swift`, NSUbiquitousKeyValueStore) but needs a paid
  Apple Developer team + the iCloud “Key-value storage” capability before it does anything.
