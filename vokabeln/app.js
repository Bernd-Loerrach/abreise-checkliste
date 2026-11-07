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

  let progress = loadProgress();
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
    progress[id] = { box, due, seen: true };
    saveProgress(progress);
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
  let ptVoice = null;
  function pickVoice() {
    if (!("speechSynthesis" in window)) return;
    const voices = speechSynthesis.getVoices();
    ptVoice =
      voices.find((v) => v.lang === "pt-PT") ||
      voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("pt")) ||
      null;
  }
  if ("speechSynthesis" in window) {
    pickVoice();
    speechSynthesis.onvoiceschanged = pickVoice;
  }
  function speak(text) {
    if (!settings.audio || !("speechSynthesis" in window)) return;
    // Drop a leading gender/article marker like "(o) " so it isn't read aloud.
    const clean = String(text).replace(/^\([^)]*\)\s*/, "");
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(clean);
      u.lang = "pt-PT";
      if (ptVoice) u.voice = ptVoice;
      u.rate = 0.9;
      speechSynthesis.speak(u);
    } catch {}
  }
  const speechAvailable = "speechSynthesis" in window;

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
  function renderHome() {
    clear();
    const s = stats();

    const view = el(`<div class="fade-in"></div>`);
    view.appendChild(
      el(`<div class="topbar">
        <div>
          <h1>Português 🇵🇹</h1>
          <div class="subtitle">Português a Valer 1 · ${ALL_CARDS.length} words</div>
        </div>
        <button class="icon-btn" id="settingsBtn" aria-label="Settings">⚙️</button>
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
        <div class="stat"><div class="num due">${s.due}</div><div class="lbl">Due</div></div>
        <div class="stat"><div class="num">${s.learned}</div><div class="lbl">Learned</div></div>
        <div class="stat"><div class="num">${s.news}</div><div class="lbl">New</div></div>
      </div>`)
    );

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

    let flipped = false;
    function flip() {
      if (flipped) return;
      flipped = true;
      flash.classList.add("flipped");
      // Speak Portuguese when the answer is revealed
      speak(card.pt);
      answers.classList.remove("single");
      answers.innerHTML = "";
      const again = el(`<button class="ans again">✗ Not yet</button>`);
      const good = el(`<button class="ans good">✓ Got it</button>`);
      again.addEventListener("click", () => opts.onRate(false));
      good.addEventListener("click", () => opts.onRate(true));
      answers.appendChild(again);
      answers.appendChild(good);
    }

    flash.addEventListener("click", (e) => {
      if (e.target.closest(".speak-btn")) return; // don't treat the speaker as a flip
      flip();
    });
    document.getElementById("reveal").addEventListener("click", flip);

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
    view.appendChild(el(`<div class="topbar"><button class="back-btn" id="exit">‹ Exit</button></div>`));
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
            ${speechAvailable ? "<div class='desc'>Read Portuguese aloud automatically</div>" : ""}</div>
          <div class="switch ${settings.audio ? "on" : ""}" id="audioSw" ${speechAvailable ? "" : 'style="opacity:.4"'}></div>
        </div>
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
    const sw = document.getElementById("audioSw");
    if (speechAvailable) {
      sw.addEventListener("click", () => {
        settings.audio = !settings.audio;
        saveSettings(settings);
        sw.classList.toggle("on", settings.audio);
      });
    }
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

  // iOS Safari: unlock audio only after the first user gesture
  document.addEventListener(
    "touchstart",
    function unlock() {
      if (speechAvailable && settings.audio) {
        try {
          const u = new SpeechSynthesisUtterance("");
          speechSynthesis.speak(u);
        } catch {}
      }
      document.removeEventListener("touchstart", unlock);
    },
    { once: true, passive: true }
  );

  renderHome();
})();
