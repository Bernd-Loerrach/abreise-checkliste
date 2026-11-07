# Daniel's Vocabulary App — Mandarin (HSK 1 & 2) 🇨🇳

A small, self-contained flashcard web app (PWA) for learning Mandarin Chinese.
Plain HTML / CSS / JavaScript — **no build step, no dependencies**. Just edit the
files and open `index.html` through a local web server.

**Live version:** https://bernd-loerrach.github.io/abreise-checkliste/mandarin/

## What's in here

| File | What it is |
|------|------------|
| `data.js` | **The vocabulary** — edit this to add/change words. ← start here |
| `app.js` | All the app logic (flashcards, spaced repetition, quiz, audio) |
| `styles.css` | Styling (light/dark, layout) |
| `index.html` | The page shell |
| `sw.js` | Service worker (offline support). **Bump `CACHE` (e.g. `zh-vocab-v3`) whenever you change files** so devices pick up the update |
| `manifest.webmanifest` | App metadata (name, icons, colours) |
| `icon*.png` / `icon*.svg` | App icons |

## Adding or editing words

Open `data.js`. Vocabulary lives in `DECKS` (topics). Each word is one object:

```js
{ zh: "你好", pin: "nǐ hǎo", en: "hello" },      // zh = characters, pin = pinyin, en = English
{ zh: "医院", pin: "yīyuàn", en: "hospital", note: "optional hint" },
```

- Add a word by inserting another `{ zh, pin, en }` line inside a deck's `cards: [ ... ]`.
- Add a whole new topic by copying one of the `{ id, icon, name, namePt, cards: [...] }`
  blocks (give it a unique `id`).
- Pinyin uses tone marks (ā á ǎ à …). Audio and the pinyin display come straight from
  these fields.

## Running it locally

From inside this folder:

```bash
python3 -m http.server 8000
```

Then open **http://localhost:8000** in a browser. (A plain `file://` open won't fully
work because of the service worker — use the little server above.)

## Notes
- Progress is stored per-device in the browser (localStorage) — it does **not** sync
  between devices.
- Mandarin audio uses the browser's built-in `zh-CN` voice (works on iPhone, Mac, etc.).
- Chinese verbs don't conjugate, so unlike the Portuguese sibling app there's no
  conjugation feature here.

Built with Claude. Have fun — 加油! 🚀
