# For Daniel: build Dad's Portuguese app under your developer account

Hi Daniel, this note is for you and your Claude. Paste it into Claude Code on your Mac.

**Goal:** build the native iOS app in this folder under your paid Apple Developer account,
switch on iCloud sync, and share it with Dad through **TestFlight**. That way neither of you
has the 7-day limit of free signing.

## What this is

* A SwiftUI app (iOS 17+, iPhone + iPad; it runs on Apple-silicon Macs as "Designed for iPad").
  No third-party packages and no build scripts.
* Repository: `https://github.com/Bernd-Loerrach/abreise-checkliste`. The app is in `native/Portugues/`.
  The web version of the same app is in `vokabeln/`.
* The words are in `native/Portugues/Portugues/vocab.json`. The app also downloads the latest list from
  `https://bernd-loerrach.github.io/abreise-checkliste/vokabeln/vocab.json` on launch, so new
  words **don't** need a new TestFlight build. Dad's Claude keeps that file up to date.
* Progress is kept per device in UserDefaults. `ProgressStore.swift` already has iCloud key-value-store
  sync (`NSUbiquitousKeyValueStore`, key `progress-v1`, merge rule: latest answer per card wins).
  It only needs the entitlement (step 3).

## Steps

1. **Get the code.** Run `git clone https://github.com/Bernd-Loerrach/abreise-checkliste.git` (or Dad adds you as a
   collaborator if the repo is private). Open `native/Portugues/Portugues.xcodeproj` in Xcode.
2. **Signing.** Target *Portugues* → Signing & Capabilities → Team = **your** team.
   Change the **Bundle Identifier** from `de.berndloerrach.portugues` to one of yours,
   for example `com.<you>.portugues`, because Dad's free team already uses that ID.
3. **iCloud sync.** Click "+ Capability" → **iCloud**, then tick **Key-value storage**. Xcode creates the entitlements file.
   Then update the wording in `Portugues/SettingsView.swift`:
   * the label "Automatic iCloud sync – coming soon" → "Syncs automatically through iCloud"
   * the footer under it → explain that devices on the same Apple Account sync by themselves, and that the
     progress file is for moving progress from the web version
   * the "📱 Your progress" text in `HelpView` (same file) → say that sync is on
4. **Test on your iPhone.** Pick the device and press ▶. Check that Learn, Quiz and the conjugation sheet work.
5. **TestFlight.**
   * In App Store Connect, create a new app with your bundle ID. The name must be unique on the store,
     for example "Bernd's Portuguese".
   * In Xcode: set the destination to *Any iOS Device (arm64)*, then **Product → Archive** → **Distribute App** → *TestFlight & App Store*.
   * In App Store Connect → TestFlight: add yourself as an **internal tester**, then add Dad as a user of
     your team (role *Customer Support* or *Marketing* is enough) and as an internal tester. Internal testing needs **no**
     Apple review.
   * Dad installs **TestFlight** from the App Store and accepts the invite.
6. **Later updates.** Bump the build number, Archive again and upload. Each build lasts 90 days.

## Notes

* Build from the command line on Dad's Mac: `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcodebuild ...`
  (xcode-select points to the Command Line Tools there). Not relevant on your Mac.
* Dad's existing test install (bundle `de.berndloerrach.portugues`) and the TestFlight app (your bundle ID)
  are **separate apps**, so their progress doesn't carry over. Moving it is easy: Settings → "Send progress file"
  in the old app, then "Load progress file" in the new one.
* Copyright: the vocabulary is based on the textbook *Português a Valer 1* (Lidel). That's fine for
  family use through TestFlight, but it shouldn't go on the public App Store as it is.
