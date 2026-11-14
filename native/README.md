# Português – native iPhone / iPad / Mac app

SwiftUI version of the vocabulary trainer in `../vokabeln/` (same words, same
learning logic, same progress-file format).

* Open `Portugues/Portugues.xcodeproj` in Xcode and press ▶ (iPhone simulator or your own device).
* Words: `Portugues/Portugues/vocab.json`, generated from the web app's `data.js` +
  `conjugations.js` by `sh tools/export_vocab_json.sh` (run from the repo root after adding words).
  The same file is published at `vokabeln/vocab.json`; the app downloads it on launch,
  so new words reach the app without an App Store update.
* iCloud sync is on (`ProgressStore.swift`, NSUbiquitousKeyValueStore, key `progress-v1`;
  entitlement in `Portugues/Portugues.entitlements`). Signed with Bernd's paid team XV2WX4M26G.
* Sharing / updates via TestFlight: see `TESTFLIGHT.md`.
