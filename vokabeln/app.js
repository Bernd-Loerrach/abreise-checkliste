/* Português A1 – Vocabulary Trainer
   Single-file logic: router + learning (spaced repetition) + quiz + browsing + settings.
   Progress is stored per device in localStorage. */

(() => {
  "use strict";

  const STORE_KEY = "pt-vocab-v1";
  const SETTINGS_KEY = "pt-vocab-settings-v1";

  // Leitner intervals in days per box level. Box 0 = new/unknown.
  const INTERVALS = [0, 1, 3, 7, 16, 35, 90];
  const MAX_BOX = INTERVALS.length - 1;
  const LEARN_BATCH = 10; // new cards per "Learn" session

  const DAY = 24 * 60 * 60 * 1000;
  const app = document.getElementById("app");

  // ---------- Load/save state ----------
  function loadProgress() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY)) || {};
    } catch {
      return {};
    }
  }
  function saveProgress(p) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(p));
    } catch {}
  }
  function loadSettings() {
    let s = {};
    try {
      s = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
    } catch {}
    s = Object.assign({ direction: "pt-en", audio: true, theme: "auto" }, s);
    // Migrate older German direction values.
    if (s.direction === "pt-de") s.direction = "pt-en";
    if (s.direction === "de-pt") s.direction = "en-pt";
    return s;
  }
  function saveSettings(s) {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    } catch {}
  }

  let progress = renameIds(loadProgress());
  saveProgress(progress);
  let settings = loadSettings();
  applyTheme();

  function applyTheme() {
    if (settings.theme === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", settings.theme);
  }

  // ---------- SRS helpers ----------
  function cardState(id) {
    return progress[id] || { box: 0, due: 0, seen: false };
  }
  function isDue(id, now) {
    const st = cardState(id);
    if (!st.seen) return false; // unseen cards are "new", not "due"
    return st.due <= now;
  }
  function isNew(id) {
    return !cardState(id).seen;
  }
  function isLearned(id) {
    return cardState(id).box >= 2; // box 2+ counts as learned
  }

  function rate(id, correct) {
    const st = cardState(id);
    let box;
    if (correct) box = Math.min(MAX_BOX, (st.box || 0) + 1);
    else box = 1; // back to box 1
    const due = Date.now() + INTERVALS[box] * DAY;
    progress[id] = { box, due, seen: true, t: Date.now() }; // t = when last answered (for syncing)
    saveProgress(progress);
  }

  // ---------- Sync between devices (send / load a progress file) ----------
  function validEntry(e) {
    return e && typeof e === "object" && Number.isFinite(e.box) && e.box >= 0 && e.box <= MAX_BOX &&
      Number.isFinite(e.due) && typeof e.seen === "boolean";
  }
  // Is entry b (from the other device) newer/better than a (this device)?
  function wins(b, a) {
    if (!a) return true;
    if (Number.isFinite(b.t) && Number.isFinite(a.t)) return b.t > a.t; // latest answer wins
    if (Number.isFinite(b.t) !== Number.isFinite(a.t)) {
      if (b.box !== a.box) return b.box > a.box;
      return Number.isFinite(b.t);
    }
    return b.box > a.box || (b.box === a.box && b.due > a.due); // older data: furthest along wins
  }
  // Words that moved to another deck keep their progress (old id -> new id, see renamed.js).
  function renameIds(p) {
    const map = typeof RENAMED !== "undefined" ? RENAMED : {};
    const out = {};
    for (const [id, e] of Object.entries(p || {})) {
      const nid = map[id] || id;
      if (!out[nid] || (validEntry(e) && wins(e, out[nid]))) out[nid] = e;
    }
    return out;
  }
  function mergeProgress(incoming) {
    incoming = renameIds(incoming);
    let changed = 0;
    for (const [id, e] of Object.entries(incoming)) {
      if (!validEntry(e)) continue;
      if (wins(e, progress[id])) {
        const st = { box: e.box, due: e.due, seen: e.seen };
        if (Number.isFinite(e.t)) st.t = e.t;
        progress[id] = st;
        changed++;
      }
    }
    saveProgress(progress);
    return changed;
  }
  async function sendProgress(msg) {
    const day = new Date().toISOString().slice(0, 10);
    const name = `portugues-progress-${day}.json`;
    const data = JSON.stringify({ app: "pt-vocab", v: 1, exported: Date.now(), progress });
    const file = new File([data], name, { type: "application/json" });
    const words = Object.values(progress).filter((e) => e && e.seen).length;
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "Portuguese progress" });
        msg(`✓ Sent (${words} words practised). Now tap “Load progress” on the other device.`);
        return;
      } catch (e) {
        if (e && e.name === "AbortError") return; // closed the share sheet
      }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(file);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    msg(`✓ Saved “${name}” to Downloads. Send it to the other device (AirDrop, Mail…), then tap “Load progress” there.`);
  }
  async function loadProgressFile(file, msg) {
    try {
      const obj = JSON.parse(await file.text());
      if (!obj || obj.app !== "pt-vocab" || typeof obj.progress !== "object") throw new Error("wrong file");
      const changed = mergeProgress(obj.progress);
      const when = obj.exported ? new Date(obj.exported).toLocaleString() : "";
      const s = stats();
      msg(changed
        ? `✓ Loaded: ${changed} word${changed === 1 ? "" : "s"} updated${when ? ` (file from ${when})` : ""}. Learned now: ${s.learned}.`
        : `✓ Already up to date – nothing new in this file${when ? ` (from ${when})` : ""}.`);
    } catch {
      msg("⚠️ That isn't a progress file from this app. Pick the “portugues-progress-….json” file.", true);
    }
  }

  // ---------- Statistics ----------
  function stats() {
    const now = Date.now();
    let learned = 0,
      due = 0,
      news = 0;
    for (const c of ALL_CARDS) {
      if (isNew(c.id)) news++;
      else {
        if (isLearned(c.id)) learned++;
        if (isDue(c.id, now)) due++;
      }
    }
    return { learned, due, news, total: ALL_CARDS.length };
  }

  function deckStats(deck) {
    let learned = 0;
    for (const c of ALL_CARDS) {
      if (c.deckId === deck.id && isLearned(c.id)) learned++;
    }
    return { learned, total: deck.cards.length };
  }

  // ---------- Text-to-speech (European Portuguese) ----------
  // Some devices (notably iPads) list Portuguese voices that aren't actually
  // downloaded; forcing one of those gives silence. So: use the voice chosen in
  // Settings (or the first pt-PT voice), and if it doesn't start speaking within
  // ~1.2 s, retry with the system's own Portuguese voice and remember that.
  let ptVoices = [];
  let forcedVoiceFails = false;
  let speakSeq = 0;
  function pickVoice() {
    if (!("speechSynthesis" in window)) return;
    const all = speechSynthesis.getVoices().filter((v) => v.lang && v.lang.toLowerCase().replace("_", "-").startsWith("pt"));
    // European Portuguese first
    ptVoices = all.sort((a, b) => (b.lang.replace("_", "-") === "pt-PT") - (a.lang.replace("_", "-") === "pt-PT"));
  }
  if ("speechSynthesis" in window) {
    pickVoice();
    speechSynthesis.onvoiceschanged = pickVoice;
  }
  function chosenVoice() {
    if (settings.voiceURI === "system") return null;
    if (settings.voiceURI) return ptVoices.find((v) => v.voiceURI === settings.voiceURI) || null;
    if (forcedVoiceFails) return null;
    return ptVoices[0] || null;
  }
  function speak(text, isRetry) {
    if (!settings.audio || !("speechSynthesis" in window)) return;
    // Drop a leading gender/article marker like "(o) " so it isn't read aloud.
    const clean = String(text).replace(/^\([^)]*\)\s*/, "");
    const seq = ++speakSeq;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(clean);
      u.lang = "pt-PT";
      u.rate = 0.9;
      const v = isRetry ? null : chosenVoice();
      if (v) {
        u.voice = v;
        u.lang = v.lang;
        let started = false;
        u.onstart = () => { started = true; };
        setTimeout(() => {
          if (!started && seq === speakSeq) {
            if (!settings.voiceURI) forcedVoiceFails = true;
            speak(text, true);
          }
        }, 1200);
      }
      speechSynthesis.speak(u);
    } catch {}
  }
  const speechAvailable = "speechSynthesis" in window;

  // Mute / unmute: one tap silences everything (auto-play and the 🔊 buttons).
  function muteBtn() {
    if (!speechAvailable) return "";
    const on = settings.audio;
    return `<button class="icon-btn mute-btn" aria-label="${on ? "Mute sound" : "Turn sound on"}">${on ? "🔊" : "🔇"}</button>`;
  }
  function syncMute() {
    document.body.classList.toggle("muted", !settings.audio);
    document.querySelectorAll(".mute-btn").forEach((b) => {
      b.textContent = settings.audio ? "🔊" : "🔇";
      b.setAttribute("aria-label", settings.audio ? "Mute sound" : "Turn sound on");
    });
  }
  function setAudio(on) {
    settings.audio = on;
    saveSettings(settings);
    if (!on) {
      try { speechSynthesis.cancel(); } catch {}
    } else {
      // This tap is a user gesture, so it also unlocks speech on iPhone/iPad.
      try { speechSynthesis.speak(new SpeechSynthesisUtterance(" ")); } catch {}
    }
    syncMute();
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest(".mute-btn");
    if (!b) return;
    e.stopPropagation();
    setAudio(!settings.audio);
  });
  syncMute();

  // Test button: speak a phrase and report exactly what the browser did, so a
  // silent device can be diagnosed (didn't start / error / played but muted).
  function diagnoseSpeech() {
    const out = document.getElementById("voiceDiag");
    const show = (msg) => { if (out) out.innerHTML = msg; };
    if (!("speechSynthesis" in window)) return show("✗ This browser has no speech support.");
    pickVoice();
    const all = speechSynthesis.getVoices().length;
    const head = `Voices on device: ${all} · Portuguese: ${ptVoices.length}<br>`;
    let started = false, ended = false, errored = false;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance("Olá! Bom dia.");
      u.lang = "pt-PT";
      u.rate = 0.9;
      const v = chosenVoice();
      if (v) { u.voice = v; u.lang = v.lang; }
      u.onstart = () => { started = true; show(head + "▶ Speaking… (using " + (v ? v.name : "device default") + ")"); };
      u.onend = () => {
        ended = true;
        if (!errored) show(head + "✓ The browser says it <b>played</b> the sentence.<br>If you heard nothing, the sound is being muted by the iPad: check <b>Silent mode</b> (bell in Control Center), the <b>volume</b>, and that no <b>Bluetooth</b> headphones/speaker are connected.");
      };
      u.onerror = (e) => {
        errored = true;
        show(head + "✗ Speech error: <b>" + esc(e.error || "unknown") + "</b>");
      };
      show(head + "…starting");
      speechSynthesis.speak(u);
      setTimeout(() => {
        if (!started && !errored) show(head + "✗ Speech <b>never started</b> (speaking=" + speechSynthesis.speaking + ", pending=" + speechSynthesis.pending + "). Try opening the app in <b>Safari</b> instead of the home-screen icon.");
      }, 2500);
    } catch (err) {
      show(head + "✗ Exception: " + esc(err && err.message));
    }
  }

  // ---------- Small DOM helpers ----------
  function el(html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])
    );
  }
  function shuffle(a) {
    const r = a.slice();
    for (let i = r.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [r[i], r[j]] = [r[j], r[i]];
    }
    return r;
  }
  function clear() {
    app.innerHTML = "";
  }
  function haptic() {
    if (navigator.vibrate) {
      try { navigator.vibrate(8); } catch {}
    }
  }

  // ---------- Infopedia links (Porto Editora dictionary, opens online) ----------
  // Clean a card's Portuguese into a lookup word: drop "(o) " markers, trailing
  // "(de)" notes, alternatives after a comma, and punctuation.
  function lookupWord(pt) {
    return String(pt)
      .replace(/^\([^)]*\)\s*/, "")
      .replace(/\s*\([^)]*\)\s*$/, "")
      .split(",")[0]
      .replace(/[?!.¿¡…]/g, "")
      .trim()
      .toLowerCase();
  }
  function infopediaDict(pt) {
    return "https://www.infopedia.pt/dicionarios/portugues-ingles/" + encodeURIComponent(lookupWord(pt));
  }
  function infopediaVerb(pt) {
    const v = lookupWord(pt).replace(/-se$/, "").split(" ")[0];
    return "https://www.infopedia.pt/dicionarios/verbos-portugueses/" + encodeURIComponent(v);
  }

  // ---------- Verb conjugations (present tense, on demand) ----------
  const PRONOUNS = ["eu", "tu", "ele / ela / você", "nós", "eles / elas / vocês"];
  function hasConj(card) {
    return typeof CONJ !== "undefined" && CONJ[card.pt];
  }
  // Which tense the conjugation panel shows; remembered while the app is open.
  let conjTense = "f"; // "f" = presente, "p" = pretérito perfeito, "i" = imperativo
  const IMP_PRONOUNS = ["tu", "tu (negative)", "você", "vocês"];
  const TENSES = {
    f: { btn: "Presente", name: "present tense", forms: "f", kind: "t", pron: PRONOUNS },
    p: { btn: "Pretérito", name: "past tense (pretérito perfeito)", forms: "p", kind: "tp", pron: PRONOUNS },
    i: { btn: "Imperativo", name: "imperative · tu = informal, você(s) = formal", forms: "i", kind: "ti", pron: IMP_PRONOUNS },
  };
  function openConj(card) {
    const entry = CONJ[card.pt];
    const tLabels = { regular: "Regular", irregular: "Irregular", impersonal: "Impersonal" };
    const avail = Object.keys(TENSES).filter((k) => Array.isArray(entry[TENSES[k].forms]));
    if (!avail.includes(conjTense)) conjTense = "f";
    const overlay = el(`<div class="conj-overlay">
        <div class="conj-sheet">
          <div class="conj-head">
            <div>
              <div class="conj-title">${esc(card.pt)}</div>
              <div class="conj-sub" id="conjSub"></div>
            </div>
            <button class="conj-close" aria-label="Close">✕</button>
          </div>
          ${avail.length > 1 ? `<div class="seg conj-tenses" id="conjTenses">
            ${avail.map((k) => `<button data-v="${k}">${TENSES[k].btn}</button>`).join("")}
          </div>` : ""}
          <div id="conjRows"></div>
          <a class="info-link conj-more" href="${infopediaVerb(card.pt)}" target="_blank" rel="noopener">📘 All tenses on Infopedia ↗</a>
        </div>
      </div>`);
    function paint() {
      const T = TENSES[conjTense];
      const forms = entry[T.forms];
      const kind = entry[T.kind];
      overlay.querySelector("#conjSub").innerHTML =
        `${esc(card.en)} · ${T.name} <span class="conj-tag ${kind}">${tLabels[kind] || ""}</span>`;
      overlay.querySelector("#conjRows").innerHTML = forms
        .map((f, i) =>
          f
            ? `<div class="conj-row"><span class="conj-pron">${T.pron[i]}</span><span class="conj-form">${esc(f)}${conjTense === "i" ? "!" : ""}</span>${
                speechAvailable ? `<button class="conj-say" data-f="${esc(f)}" aria-label="Speak">🔊</button>` : ""
              }</div>`
            : ""
        )
        .join("");
      overlay.querySelectorAll(".conj-say").forEach((b) =>
        b.addEventListener("click", (e) => { e.stopPropagation(); speak(b.dataset.f); })
      );
      overlay.querySelectorAll("#conjTenses button").forEach((b) =>
        b.classList.toggle("active", b.dataset.v === conjTense)
      );
    }
    overlay.querySelectorAll("#conjTenses button").forEach((b) =>
      b.addEventListener("click", (e) => { e.stopPropagation(); conjTense = b.dataset.v; paint(); })
    );
    paint();
    const close = () => overlay.remove();
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
    overlay.querySelector(".conj-close").addEventListener("click", close);
    document.body.appendChild(overlay);
  }

  // Front/back depending on direction. "both" picks a side at random per card.
  function resolveDir() {
    return settings.direction === "both"
      ? (Math.random() < 0.5 ? "pt-en" : "en-pt")
      : settings.direction;
  }
  function front(card, dir) { return dir === "pt-en" ? card.pt : card.en; }
  function back(card, dir) { return dir === "pt-en" ? card.en : card.pt; }
  function frontLang(dir) { return dir === "pt-en" ? "Português" : "English"; }
  function backLang(dir) { return dir === "pt-en" ? "English" : "Português"; }

  // =================================================================
  //  HOME
  // =================================================================
  // ---------- Help texts ----------
  const STAT_HELP = {
    due: "<b>Due</b> – words scheduled for review today. <b>Learn</b> works through them first.",
    learned: "<b>Learned</b> – words you got right on <b>two different days</b>. Your first “Got it” starts the clock: the word comes back tomorrow, and if you know it again, it counts as learned.",
    new: "<b>New</b> – words you haven't practised yet. Each <b>Learn</b> session adds up to " + LEARN_BATCH + " of them.",
  };

  function renderHelp(firstTime) {
    clear();
    const ladder = INTERVALS.slice(1)
      .map((d) => `<span>${d === 1 ? "tomorrow" : d + " days"}</span>`)
      .join("<i>→</i>");
    const view = el(`<div class="fade-in help">
        <div class="topbar">
          ${firstTime ? "" : `<button class="back-btn" id="back">‹ Back</button>`}
          <h1 style="font-size:20px;${firstTime ? "" : "margin-left:4px"}">How it works</h1>
        </div>
        ${firstTime ? `<p class="help-intro">Welcome! 👋 Here's a one-minute guide. You can open it again anytime with the <b>ⓘ</b> button on the home screen.</p>` : ""}

        <div class="help-card">
          <h3>🎯 Learn</h3>
          <p>Each session mixes the words <b>due</b> for review with up to ${LEARN_BATCH} <b>new</b> ones.</p>
          <p>Look at the card, try to recall the answer, then <b>tap to flip</b> (tap again to flip back). Rate yourself honestly:
            <b>✓ Got it</b> or <b>✗ Not yet</b>. Missed words come back again at the end of the session.</p>
        </div>

        <div class="help-card">
          <h3>📈 Why words come back later</h3>
          <p>The app uses <b>spaced repetition</b>. Every “Got it” sends a word further into the future:</p>
          <div class="help-ladder">${ladder}</div>
          <p>“Not yet” starts it again from tomorrow. You review each word just before you'd forget it, so <b>a few minutes every day</b> works better than one long session.</p>
        </div>

        <div class="help-card">
          <h3>🔢 The three numbers</h3>
          <p><b>Due</b> – to review today. <b>New</b> – not practised yet.</p>
          <p><b>Learned</b> – got right on <b>two different days</b>. So after your first session Learned is still 0 – that's normal. It starts growing from day two.</p>
          <p class="dim">Tip: tap a number on the home screen for a quick reminder.</p>
        </div>

        <div class="help-card">
          <h3>🧭 More features</h3>
          <ul>
            <li><b>Direction</b> (top of the home screen): Portuguese → English, English → Portuguese, or Both mixed.</li>
            <li><b>Topics</b>: practise one topic at a time, or browse all its words.</li>
            <li><b>🧩 Quiz</b>: quick multiple choice; your answers count too.</li>
            <li><b>📖 Conjugation</b> on verb cards: present, past (pretérito perfeito) and imperative, marked regular or irregular.</li>
            <li><b>📘 Infopedia</b>: opens the word in the Infopedia dictionary (needs internet).</li>
            <li><b>🔊 Sound</b>: Portuguese pronunciation. No sound? ⚙️ Settings → Voice → Test.</li>
          </ul>
        </div>

        <div class="help-card">
          <h3>📱 Your progress</h3>
          <p>Progress is saved <b>on this device only</b> – iPhone, iPad and Mac each keep their own. On iPhone/iPad the home-screen icon and Safari are separate too, so always open it the same way.</p>
          <p>To bring them together: <b>⚙️ Settings → Sync between devices</b>. Tap <b>Send progress</b> on the device you just used, then <b>Load progress</b> on the other one. Nothing gets lost – for each word your latest answer is kept.</p>
          <p>Install it with Safari → Share → <b>Add to Home Screen</b>. After that it also works <b>offline</b>.</p>
        </div>

        <button class="cta" id="helpDone" style="justify-content:center">
          <span class="cta-text" style="text-align:center;flex:none">${firstTime ? "Let's start 🚀" : "Back to home"}</span>
        </button>
      </div>`);
    app.appendChild(view);
    window.scrollTo(0, 0);
    const back = document.getElementById("back");
    if (back) back.addEventListener("click", renderHome);
    document.getElementById("helpDone").addEventListener("click", renderHome);
  }

  function renderHome() {
    clear();
    const s = stats();

    const view = el(`<div class="fade-in"></div>`);
    view.appendChild(
      el(`<div class="topbar">
        <div>
          <h1>Português 🇵🇹</h1>
          <div class="subtitle">European Portuguese · ${ALL_CARDS.length} words</div>
        </div>
        <div class="topbar-actions">
          ${muteBtn()}
          <button class="icon-btn" id="helpBtn" aria-label="How it works">ⓘ</button>
          <button class="icon-btn" id="settingsBtn" aria-label="Settings">⚙️</button>
        </div>
      </div>`)
    );

    view.appendChild(
      el(`<div class="dir-switch" id="dirSwitch">
        <button data-v="pt-en" class="${settings.direction === "pt-en" ? "active" : ""}">PT → EN</button>
        <button data-v="en-pt" class="${settings.direction === "en-pt" ? "active" : ""}">EN → PT</button>
        <button data-v="both" class="${settings.direction === "both" ? "active" : ""}">Both</button>
      </div>`)
    );

    view.appendChild(
      el(`<div class="stats-row">
        <button class="stat" data-k="due"><div class="num due">${s.due}</div><div class="lbl">Due</div></button>
        <button class="stat" data-k="learned"><div class="num">${s.learned}</div><div class="lbl">Learned</div></button>
        <button class="stat" data-k="new"><div class="num">${s.news}</div><div class="lbl">New</div></button>
      </div>`)
    );
    const statHint = el(`<div class="stat-hint" id="statHint" hidden></div>`);
    view.appendChild(statHint);

    // Learn (due + new cards)
    const learnCount = s.due + Math.min(s.news, LEARN_BATCH);
    const learnBtn = el(`<button class="cta" id="learnBtn" ${learnCount === 0 ? "disabled" : ""}>
        <span class="big-emoji">🎯</span>
        <span class="cta-text">Learn
          <span class="cta-sub">${
            learnCount === 0 ? "All done – come back later" : "Due reviews + new words"
          }</span>
        </span>
        ${learnCount > 0 ? `<span class="badge">${learnCount}</span>` : `<span class="chev">✓</span>`}
      </button>`);
    learnBtn.addEventListener("click", () => startLearn());
    view.appendChild(learnBtn);

    const quizBtn = el(`<button class="cta secondary" id="quizBtn" ${
      s.total < 4 ? "disabled" : ""
    }>
        <span class="big-emoji">🧩</span>
        <span class="cta-text">Quiz
          <span class="cta-sub">Multiple choice over all words</span>
        </span>
        <span class="chev">›</span>
      </button>`);
    quizBtn.addEventListener("click", () => startQuiz());
    view.appendChild(quizBtn);

    view.appendChild(el(`<div class="section-title">Topics</div>`));
    for (const deck of DECKS) {
      const ds = deckStats(deck);
      const pct = Math.round((ds.learned / ds.total) * 100);
      const d = el(`<button class="deck">
          <span class="deck-emoji">${deck.icon}</span>
          <span class="deck-body">
            <span class="deck-name">${esc(deck.name)}</span>
            <span class="deck-pt">${esc(deck.namePt)} · ${ds.learned}/${ds.total}</span>
            <span class="progress-bar"><span style="width:${pct}%"></span></span>
          </span>
          <span class="deck-right"><span class="chev">›</span></span>
        </button>`);
      d.addEventListener("click", () => renderDeck(deck));
      view.appendChild(d);
    }

    app.appendChild(view);
    document.getElementById("settingsBtn").addEventListener("click", renderSettings);
    document.getElementById("helpBtn").addEventListener("click", () => renderHelp(false));
    view.querySelectorAll(".stat").forEach((b) =>
      b.addEventListener("click", () => {
        const k = b.dataset.k;
        const open = statHint.dataset.k === k && !statHint.hidden;
        view.querySelectorAll(".stat").forEach((x) => x.classList.remove("active"));
        if (open) { statHint.hidden = true; statHint.dataset.k = ""; return; }
        statHint.innerHTML = STAT_HELP[k];
        statHint.dataset.k = k;
        statHint.hidden = false;
        b.classList.add("active");
      })
    );
    view.querySelectorAll("#dirSwitch button").forEach((b) =>
      b.addEventListener("click", () => {
        settings.direction = b.dataset.v;
        saveSettings(settings);
        renderHome();
      })
    );
  }

  // =================================================================
  //  DECK DETAIL (topic overview + learn/quiz this topic)
  // =================================================================
  function renderDeck(deck) {
    clear();
    const view = el(`<div class="fade-in"></div>`);
    view.appendChild(
      el(`<div class="topbar">
        <button class="back-btn" id="back">‹ Topics</button>
        <div class="icon-btn" style="margin-left:auto">${deck.icon}</div>
      </div>`)
    );
    view.appendChild(
      el(`<div style="margin:0 2px 16px">
        <h1 style="margin:0;font-size:26px;letter-spacing:-0.02em">${esc(deck.name)}</h1>
        <div class="subtitle" style="font-size:14px">${deck.cards.length} words starting with “${esc(deck.icon)}”</div>
      </div>`)
    );

    const deckCards = ALL_CARDS.filter((c) => c.deckId === deck.id);

    const learnBtn = el(`<button class="cta">
        <span class="big-emoji">🎯</span>
        <span class="cta-text">Learn this topic<span class="cta-sub">Practise all ${deck.cards.length} words</span></span>
        <span class="chev">›</span>
      </button>`);
    learnBtn.addEventListener("click", () => startSession(shuffle(deckCards), "Learn: " + deck.name));
    view.appendChild(learnBtn);

    const quizBtn = el(`<button class="cta secondary">
        <span class="big-emoji">🧩</span>
        <span class="cta-text">Quiz this topic<span class="cta-sub">Multiple choice</span></span>
        <span class="chev">›</span>
      </button>`);
    quizBtn.addEventListener("click", () => startQuiz(deckCards, "Quiz: " + deck.name));
    view.appendChild(quizBtn);

    view.appendChild(el(`<div class="section-title">All words</div>`));
    for (const c of deckCards) {
      const item = el(`<div class="browse-item">
          <span class="box-dot ${isLearned(c.id) ? "learned" : ""}"></span>
          <span>
            <span class="pt">${esc(c.pt)}</span><br>
            <span class="de">${esc(c.en)}${c.note ? " · " + esc(c.note) : ""}</span>
          </span>
          <a class="mini-info" href="${infopediaDict(c.pt)}" target="_blank" rel="noopener" aria-label="Look up on Infopedia">📘</a>
          ${speechAvailable ? `<button class="mini-speak" aria-label="Speak">🔊</button>` : ""}
        </div>`);
      const sp = item.querySelector(".mini-speak");
      if (sp) sp.addEventListener("click", () => speak(c.pt));
      view.appendChild(item);
    }

    app.appendChild(view);
    document.getElementById("back").addEventListener("click", renderHome);
  }

  // =================================================================
  //  LEARN SESSION (flashcards with SRS)
  // =================================================================
  function startLearn() {
    const now = Date.now();
    const due = ALL_CARDS.filter((c) => isDue(c.id, now));
    const news = ALL_CARDS.filter((c) => isNew(c.id)).slice(0, LEARN_BATCH);
    const queue = shuffle(due).concat(news);
    if (queue.length === 0) return renderHome();
    startSession(queue, "Learn");
  }

  function startSession(queue, title) {
    let idx = 0;
    const total = queue.length; // number of unique words
    let correct = 0; // unique words answered correctly (at some point)
    const seenIds = new Set();
    const requeue = []; // wrong answers repeated at the end

    function step() {
      clear();
      // Queue empty? -> repeat the wrong ones, otherwise finish
      if (idx >= queue.length) {
        if (requeue.length) {
          queue = requeue.splice(0);
          idx = 0;
        } else {
          return renderDone(title, correct, total);
        }
      }
      const card = queue[idx];
      renderCard(card, {
        title,
        index: Math.min(seenIds.size + 1, total),
        total,
        onRate: (ok) => {
          rate(card.id, ok);
          if (!seenIds.has(card.id)) {
            seenIds.add(card.id);
            if (ok) correct++;
          }
          if (!ok && !requeue.includes(card)) requeue.push(card);
          idx++;
          haptic();
          step();
        },
        onExit: renderHome,
      });
    }
    step();
  }

  function renderCard(card, opts) {
    clear();
    const view = el(`<div class="fade-in"></div>`);
    view.appendChild(
      el(`<div class="topbar">
        <button class="back-btn" id="exit">‹ Exit</button>
        ${muteBtn()}
      </div>`)
    );

    const pct = Math.round(((opts.index - 1) / opts.total) * 100);
    view.appendChild(
      el(`<div class="session-progress"><span style="width:${pct}%"></span></div>
          <div class="session-meta"><span>${esc(opts.title)}</span><span>${opts.index} / ${opts.total}</span></div>`)
    );

    const dir = resolveDir();
    const stage = el(`<div class="card-stage"></div>`);
    const fWord = front(card, dir);
    const bWord = back(card, dir);
    const flash = el(`<div class="flashcard" id="flash">
        <div class="flashcard-inner">
          <div class="face front">
            <div class="lang-tag">${frontLang(dir)}</div>
            <div class="word ${fWord.length > 12 ? "small" : ""}">${esc(fWord)}</div>
            ${
              dir === "pt-en" && speechAvailable
                ? `<button class="speak-btn" id="speakFront" aria-label="Speak">🔊</button>`
                : ""
            }
            <div class="tap-hint">Tap to flip</div>
          </div>
          <div class="face back">
            <div class="lang-tag">${backLang(dir)}</div>
            <div class="word ${bWord.length > 12 ? "small" : ""}">${esc(bWord)}</div>
            ${card.note ? `<div class="note">${esc(card.note)}</div>` : ""}
            ${
              dir === "en-pt" && speechAvailable
                ? `<button class="speak-btn" id="speakBack" aria-label="Speak">🔊</button>`
                : ""
            }
            <div class="card-actions">
              ${hasConj(card) ? `<button class="conj-btn" id="conjBtn">📖 Conjugation</button>` : ""}
              <a class="conj-btn info-link" href="${infopediaDict(card.pt)}" target="_blank" rel="noopener">📘 Infopedia</a>
            </div>
            <div class="tap-hint" style="bottom:44px">Tap to flip back</div>
            <div class="deck-chip">${card.deckIcon} ${esc(card.deckName)}</div>
          </div>
        </div>
      </div>`);
    stage.appendChild(flash);

    // Answer area (active only after flipping)
    const answers = el(`<div class="answer-row single" id="answers">
        <button class="ans reveal" id="reveal">Show answer</button>
      </div>`);
    stage.appendChild(answers);
    view.appendChild(stage);
    app.appendChild(view);

    let revealed = false;
    function showRatingButtons() {
      answers.classList.remove("single");
      answers.innerHTML = "";
      const again = el(`<button class="ans again">✗ Not yet</button>`);
      const good = el(`<button class="ans good">✓ Got it</button>`);
      again.addEventListener("click", () => opts.onRate(false));
      good.addEventListener("click", () => opts.onRate(true));
      answers.appendChild(again);
      answers.appendChild(good);
    }
    function reveal() {
      if (!revealed) {
        revealed = true;
        showRatingButtons();
      }
      flash.classList.add("flipped");
      speak(card.pt); // speak Portuguese when the answer shows
    }
    function toggleFlip() {
      if (!revealed) return reveal();
      flash.classList.toggle("flipped"); // flip freely back and forth
      if (flash.classList.contains("flipped")) speak(card.pt);
    }

    flash.addEventListener("click", (e) => {
      if (e.target.closest(".speak-btn") || e.target.closest(".conj-btn") || e.target.closest("a")) return; // not a flip
      toggleFlip();
    });
    document.getElementById("reveal").addEventListener("click", reveal);
    const cb = document.getElementById("conjBtn");
    if (cb) cb.addEventListener("click", (e) => { e.stopPropagation(); openConj(card); });

    const sf = document.getElementById("speakFront");
    if (sf) sf.addEventListener("click", (e) => { e.stopPropagation(); speak(card.pt); });
    const sb = document.getElementById("speakBack");
    if (sb) sb.addEventListener("click", (e) => { e.stopPropagation(); speak(card.pt); });

    document.getElementById("exit").addEventListener("click", opts.onExit);

    // Speak the Portuguese front once right away
    if (dir === "pt-en") speak(card.pt);
  }

  function renderDone(title, correct, total) {
    clear();
    const pct = total ? Math.round((correct / total) * 100) : 100;
    const emoji = pct >= 90 ? "🏆" : pct >= 60 ? "🎉" : "💪";
    const view = el(`<div class="fade-in">
        <div class="done-card">
          <div class="emoji">${emoji}</div>
          <h2>Well done!</h2>
          <p>${correct} of ${total} correct (${pct}%)</p>
          <p class="done-note">Words you knew come back for review in a day or two. Get them right again and they count as <b>Learned</b>.</p>
          <button class="cta" id="home" style="justify-content:center">
            <span class="cta-text" style="text-align:center;flex:none">Back to home</span>
          </button>
        </div>
      </div>`);
    app.appendChild(view);
    document.getElementById("home").addEventListener("click", renderHome);
  }

  // =================================================================
  //  QUIZ (multiple choice)
  // =================================================================
  function startQuiz(pool, title) {
    pool = pool || ALL_CARDS;
    title = title || "Quiz";
    if (pool.length < 4) {
      alert("The quiz needs at least 4 words.");
      return renderHome();
    }
    const questions = shuffle(pool).slice(0, Math.min(10, pool.length));
    let idx = 0;
    let correct = 0;

    function step() {
      if (idx >= questions.length) return renderDone(title, correct, questions.length);
      renderQuizQuestion(questions[idx], pool, {
        title,
        index: idx + 1,
        total: questions.length,
        onAnswer: (ok) => {
          rate(questions[idx].id, ok);
          if (ok) correct++;
          idx++;
        },
        next: step,
        exit: renderHome,
      });
    }
    step();
  }

  function renderQuizQuestion(card, pool, opts) {
    clear();
    const dir = resolveDir();
    // Ask in the front language; options are back-side values.
    const distractors = shuffle(pool.filter((c) => c.id !== card.id)).slice(0, 3);
    const options = shuffle([card, ...distractors]);

    const view = el(`<div class="fade-in"></div>`);
    view.appendChild(el(`<div class="topbar"><button class="back-btn" id="exit">‹ Exit</button>${muteBtn()}</div>`));
    const pct = Math.round(((opts.index - 1) / opts.total) * 100);
    view.appendChild(
      el(`<div class="session-progress"><span style="width:${pct}%"></span></div>
          <div class="session-meta"><span>${esc(opts.title)}</span><span>${opts.index} / ${opts.total}</span></div>`)
    );

    view.appendChild(
      el(`<div class="quiz-prompt">
          <div class="lang-tag">${frontLang(dir)} → ${backLang(dir)}</div>
          <div class="word">${esc(front(card, dir))}</div>
        </div>`)
    );

    const optWrap = el(`<div class="quiz-options"></div>`);
    const buttons = [];
    options.forEach((o) => {
      const b = el(`<button class="quiz-opt"><span>${esc(back(o, dir))}</span><span class="mark"></span></button>`);
      b.addEventListener("click", () => choose(o, b));
      buttons.push({ card: o, btn: b });
      optWrap.appendChild(b);
    });
    view.appendChild(optWrap);
    app.appendChild(view);

    if (dir === "pt-en") speak(card.pt);

    let answered = false;
    function choose(chosen, btn) {
      if (answered) return;
      answered = true;
      haptic();
      const ok = chosen.id === card.id;
      buttons.forEach(({ card: c, btn: b }) => {
        if (c.id === card.id) {
          b.classList.add("correct");
          b.querySelector(".mark").textContent = "✓";
        } else if (b === btn) {
          b.classList.add("wrong");
          b.querySelector(".mark").textContent = "✗";
        } else {
          b.classList.add("dim");
        }
      });
      speak(card.pt);
      opts.onAnswer(ok);
      // Pause on the result; advance only when the user taps Continue.
      const contRow = el(`<div class="answer-row single" style="margin-top:18px">
          <button class="ans good" id="qcont">Continue ›</button>
        </div>`);
      contRow.firstElementChild.addEventListener("click", opts.next);
      optWrap.after(contRow);
      contRow.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }

    document.getElementById("exit").addEventListener("click", opts.exit);
  }

  // =================================================================
  //  SETTINGS
  // =================================================================
  function renderSettings() {
    clear();
    const view = el(`<div class="fade-in"></div>`);
    view.appendChild(el(`<div class="topbar"><button class="back-btn" id="back">‹ Back</button><h1 style="font-size:20px;margin-left:4px">Settings</h1></div>`));

    // Direction
    const dirGroup = el(`<div class="setting-group">
        <div class="setting-row">
          <div>Direction<div class="desc">What's on the front of the card?</div></div>
          <div class="seg" id="dirSeg">
            <button data-v="pt-en" class="${settings.direction === "pt-en" ? "active" : ""}">PT → EN</button>
            <button data-v="en-pt" class="${settings.direction === "en-pt" ? "active" : ""}">EN → PT</button>
            <button data-v="both" class="${settings.direction === "both" ? "active" : ""}">Both</button>
          </div>
        </div>
      </div>`);
    view.appendChild(dirGroup);

    // Audio + theme
    const miscGroup = el(`<div class="setting-group">
        <div class="setting-row">
          <div>Pronunciation ${speechAvailable ? "" : "<div class='desc'>Not available on this device</div>"}
            ${speechAvailable ? "<div class='desc'>Read Portuguese aloud. Off = silent mode (same as the 🔊 / 🔇 button at the top)</div>" : ""}</div>
          <div class="switch ${settings.audio ? "on" : ""}" id="audioSw" ${speechAvailable ? "" : 'style="opacity:.4"'}></div>
        </div>
        ${speechAvailable ? `<div class="setting-row voice-row">
          <div style="flex:1">Voice<div class="desc">No sound? Pick another voice and tap Test.</div>
            <select class="voice-sel" id="voiceSel">
              <option value="" ${!settings.voiceURI ? "selected" : ""}>Automatic</option>
              <option value="system" ${settings.voiceURI === "system" ? "selected" : ""}>Device default (Portuguese)</option>
              ${(pickVoice(), ptVoices)
                .map((v) => `<option value="${esc(v.voiceURI)}" ${settings.voiceURI === v.voiceURI ? "selected" : ""}>${esc(v.name)} (${esc(v.lang)})</option>`)
                .join("")}
            </select>
          </div>
          <button class="test-btn" id="testVoice">▶ Test</button>
        </div>
        <div class="voice-diag" id="voiceDiag"></div>` : ""}
        <div class="setting-row">
          <div>Appearance</div>
          <div class="seg" id="themeSeg">
            <button data-v="auto" class="${settings.theme === "auto" ? "active" : ""}">Auto</button>
            <button data-v="light" class="${settings.theme === "light" ? "active" : ""}">Light</button>
            <button data-v="dark" class="${settings.theme === "dark" ? "active" : ""}">Dark</button>
          </div>
        </div>
      </div>`);
    view.appendChild(miscGroup);

    const syncGroup = el(`<div class="setting-group">
        <div class="setting-row">
          <div>Sync between devices
            <div class="desc">Learn on iPhone, iPad and Mac: tap <b>Send progress</b> on the device you just used
              (AirDrop, Messages, Mail…), then <b>Load progress</b> on the other one and pick that file.
              Both are combined – for each word your latest answer is kept, nothing gets lost.</div></div>
        </div>
        <div class="setting-row sync-row">
          <button class="test-btn" id="sendProg">📤 Send progress</button>
          <button class="test-btn alt" id="loadProg">📥 Load progress</button>
        </div>
        <div class="sync-msg" id="syncMsg"></div>
        <input type="file" id="loadFile" hidden>
      </div>`);
    view.appendChild(syncGroup);

    const reset = el(`<button class="danger-btn" id="reset">Reset progress</button>`);
    view.appendChild(reset);

    view.appendChild(
      el(`<div class="install-tip">💡 <b>Install as an app:</b> in Safari, tap the Share icon
        and choose “Add to Home Screen”. The trainer then opens like a real app –
        and works offline.</div>`)
    );

    app.appendChild(view);

    document.getElementById("back").addEventListener("click", renderHome);
    dirGroup.querySelectorAll("#dirSeg button").forEach((b) =>
      b.addEventListener("click", () => {
        settings.direction = b.dataset.v;
        saveSettings(settings);
        renderSettings();
      })
    );
    miscGroup.querySelectorAll("#themeSeg button").forEach((b) =>
      b.addEventListener("click", () => {
        settings.theme = b.dataset.v;
        saveSettings(settings);
        applyTheme();
        renderSettings();
      })
    );
    const voiceSel = document.getElementById("voiceSel");
    if (voiceSel) {
      voiceSel.addEventListener("change", () => {
        settings.voiceURI = voiceSel.value;
        forcedVoiceFails = false;
        saveSettings(settings);
        speak("Olá! Bom dia.");
      });
      document.getElementById("testVoice").addEventListener("click", () => diagnoseSpeech());
    }
    const sw = document.getElementById("audioSw");
    if (speechAvailable) {
      sw.addEventListener("click", () => {
        setAudio(!settings.audio);
        sw.classList.toggle("on", settings.audio);
      });
    }
    const syncMsg = document.getElementById("syncMsg");
    const msg = (text, warn) => {
      syncMsg.textContent = text;
      syncMsg.classList.add("show");
      syncMsg.classList.toggle("warn", !!warn);
    };
    document.getElementById("sendProg").addEventListener("click", () => sendProgress(msg));
    const loadFile = document.getElementById("loadFile");
    document.getElementById("loadProg").addEventListener("click", () => loadFile.click());
    loadFile.addEventListener("change", () => {
      if (loadFile.files && loadFile.files[0]) loadProgressFile(loadFile.files[0], msg);
      loadFile.value = "";
    });
    reset.addEventListener("click", () => {
      if (confirm("Really delete all your progress? This can't be undone.")) {
        progress = {};
        saveProgress(progress);
        renderHome();
      }
    });
  }

  // ---------- Service worker ----------
  // Register with updateViaCache:"none" so the browser always re-fetches the
  // worker script from the network (iOS otherwise caches it and never updates),
  // and reload once when a new version takes over so you never see a stale app.
  if ("serviceWorker" in navigator) {
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!hadController || reloaded) return;
      reloaded = true;
      location.reload();
    });
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("sw.js", { updateViaCache: "none" })
        .then((reg) => { reg.update(); })
        .catch(() => {});
    });
  }

  // iOS/iPadOS Safari: speech must be unlocked by a user gesture. Listen for
  // touch AND pointer/click, so iPads used with a keyboard/trackpad work too.
  let unlocked = false;
  function unlock() {
    if (unlocked) return;
    unlocked = true;
    if (speechAvailable && settings.audio) {
      try { speechSynthesis.speak(new SpeechSynthesisUtterance(" ")); } catch {}
    }
    ["touchstart", "pointerdown", "click"].forEach((ev) => document.removeEventListener(ev, unlock, true));
  }
  ["touchstart", "pointerdown", "click"].forEach((ev) =>
    document.addEventListener(ev, unlock, { capture: true, passive: true })
  );

  // First launch: show the "How it works" guide once.
  if (!settings.seenHelp) {
    settings.seenHelp = true;
    saveSettings(settings);
    renderHelp(true);
  } else {
    renderHome();
  }
})();
