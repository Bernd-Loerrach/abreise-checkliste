# App Store listing – copy & paste

App Store Connect → your app → **Distribution** (iOS App, version 1.0). Character limits in brackets.

## Name & subtitle

| Field | Text |
|---|---|
| **Name** (30) | `Português Vocab: PT-PT` |
| **Subtitle** (30) | `European Portuguese flashcards` |

If the name is taken, alternatives: `Vocabulário PT – Português`, `Portuguese Words PT-PT`.
The name under the icon on the Home Screen stays “Português”.

## Promotional text (170)

```
Learn 1,300 everyday words of European Portuguese – a few minutes a day with flashcards, a quick quiz, real pronunciation and verb tables.
```

## Description (4000)

```
Learn the words you really need for life in Portugal – in European Portuguese, not Brazilian.

Português Vocab is a calm, simple flashcard trainer with about 1,300 everyday words and phrases, sorted into topics like people & family, home, food, shopping, town & directions, travel, car & driving, work, paperwork, bank & post office, health, free time, outdoors and more.

HOW IT WORKS
• Learn: each session mixes the words due for review with up to 10 new ones. Flip the card, then rate yourself: “Got it” or “Not yet”.
• Spaced repetition: every word you know comes back a little later – tomorrow, in 3 days, 7, 16, 35, 90 days – right before you'd forget it.
• Difficult words: star the words you find hard – they come first and come back sooner.
• Quiz: quick multiple choice over all words or a single topic.
• Both directions: Portuguese to English, English to Portuguese, or mixed.

MADE FOR EUROPEAN PORTUGUESE
• Pronunciation with a Portuguese (Portugal) voice
• Verb conjugations for 170+ verbs: present, past (pretérito perfeito) and imperative, marked regular or irregular
• Articles and short notes where they help (“há seis meses”, “dói-me / doem-me” …)
• One tap to look up any word in the Infopedia dictionary

YOUR PROGRESS, YOUR DEVICES
• Syncs automatically between iPhone, iPad and Mac through your own iCloud
• Works offline
• No account, no ads, no tracking, no data collected

Free. Boa sorte e bons estudos!
```

## Keywords (100, comma-separated, no spaces needed)

```
portuguese,portugal,vocabulary,flashcards,PT-PT,learn,words,verbs,conjugation,lisbon,europe,language
```

## Other fields

| Field | Value |
|---|---|
| **Support URL** | `https://bernd-loerrach.github.io/abreise-checkliste/vokabeln/support.html` |
| **Marketing URL** (optional) | `https://bernd-loerrach.github.io/abreise-checkliste/vokabeln/` |
| **Privacy Policy URL** (App Information) | `https://bernd-loerrach.github.io/abreise-checkliste/vokabeln/privacy.html` |
| **Category** | Primary: Education · Secondary: Reference (optional) |
| **Copyright** | `2026 Bernd Hanemann` |
| **Age rating** | answer “None” / “No” everywhere → 4+ |
| **Price** | Free (Pricing and Availability → Price: 0) |
| **App Privacy** | “No, we do not collect data from this app” → **Data Not Collected** |
| **Content rights** | “Does your app contain, show, or access third-party content?” → **No** (the word list is our own; the Infopedia button only opens a web link) |
| **Export compliance** | already answered in the app (no encryption) |
| **Sign-in required for review** | No |
| **EU trader status** (Business → Digital Services Act) | free hobby app → usually “not a trader”; “trader” publishes your address/phone in the EU |
| **Mac** | Pricing and Availability → keep “Make this app available on Mac (Apple silicon)” ticked |

## App Review notes (optional)

```
Vocabulary trainer for European Portuguese. No login. Progress is stored locally and in the user's own iCloud key-value store. The app downloads updated word lists (JSON) from our GitHub Pages site.
```

## Screenshots

In `native/AppStore/screenshots/`:
* `iphone-6.3/` – 1206 × 2622 (**required**: "iPhone with Dynamic Island, medium display")
* `ipad-13/` – 2064 × 2752 (required, the app runs on iPad)
* `iphone-6.9/` – 1320 × 2868 (optional large display)

App Store Connect (2026): upload them in **Asset Library** (+ → Upload App Previews and Screenshots),
then on the version page → App Previews and Screenshots → View All Sizes → **Browse Assets** per slot.
No emoji or arrows in the description – Apple rejects them as invalid characters.

## Submit

1. Under **Build**, click **+** and choose the latest build. Builds uploaded as *TestFlight Internal Only* can't be chosen – upload with the App Store option (see TESTFLIGHT.md).
2. **Add for Review** → **Submit to App Review**. Review usually takes 1–2 days.
3. Release: “Automatically release this version” is fine.
