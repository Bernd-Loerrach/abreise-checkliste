# Putting the app on TestFlight

Bernd's paid Apple Developer team (XV2WX4M26G) signs the app. Bundle ID `de.berndloerrach.portugues`.

## First time

1. **App Store Connect** (https://appstoreconnect.apple.com) → *Apps* → **+** → *New App*
   * Platform: iOS · Name: something unique, e.g. "Português – Bernd" (only shown in TestFlight)
   * Language: English · Bundle ID: `de.berndloerrach.portugues` · SKU: `portugues1`
   * User access: Full access
2. **Xcode**: open `Portugues/Portugues.xcodeproj`. At the top choose the destination
   **Any iOS Device (arm64)**, then **Product → Archive**.
3. The Organizer window opens → **Distribute App** → **TestFlight Internal Only** → Distribute.
   After 5–15 minutes the build shows in App Store Connect → TestFlight (you get an email).
4. App Store Connect → **TestFlight** → *Internal Testing* → **+** → create a group
   (e.g. "Family"), add yourself. Internal testers need **no** Apple review.
5. On iPhone, iPad and Mac: install **TestFlight** from the App Store, open the invitation, tap *Install*.

Daniel or others: App Store Connect → *Users and Access* → **+** → invite them
(role *Customer Support* is enough), then add them to the TestFlight group.

## Updates

* New **words** don't need a new build – the app downloads `vokabeln/vocab.json` on launch.
* Code changes: raise **Build** (target → General, or `CURRENT_PROJECT_VERSION` in the project) by one,
  then Archive → Distribute again. Each build runs for 90 days; TestFlight reminds you.

## Notes

* The old test install from Xcode and the TestFlight version are the same app (same bundle ID):
  TestFlight replaces it and keeps the progress.
* Copyright: the vocabulary follows *Português a Valer 1* (Lidel). Fine for family TestFlight use,
  not for the public App Store as is.
