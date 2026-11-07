/* 中文 – Mandarin Vocabulary Trainer (HSK 1 & 2)
   Flip flashcards with spaced repetition, quiz, pinyin and Mandarin audio.
   Each word is shown as characters + pinyin on the Chinese side.
   Progress is stored per device in localStorage. */

(() => {
  "use strict";

  const STORE_KEY = "zh-vocab-v1";
  const SETTINGS_KEY = "zh-vocab-settings-v1";
  const INTERVALS = [0, 1, 3, 7, 16, 35, 90];
  const MAX_BOX = INTERVALS.length - 1;
  const LEARN_BATCH = 10;
  const DAY = 24 * 60 * 60 * 1000;
  const app = document.getElementById("app");

  // ---------- state ----------
  function loadProgress() { try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; } }
  function saveProgress(p) { try { localStorage.setItem(STORE_KEY, JSON.stringify(p)); } catch {} }
  function loadSettings() {
    let s = {};
    try { s = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch {}
    return Object.assign({ direction: "zh-en", audio: true, theme: "auto" }, s);
  }
  function saveSettings(s) { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch {} }

  let progress = loadProgress();
  let settings = loadSettings();
  applyTheme();
  function applyTheme() {
    if (settings.theme === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", settings.theme);
  }

  // ---------- SRS ----------
  function cardState(id) { return progress[id] || { box: 0, due: 0, seen: false }; }
  function isDue(id, now) { const s = cardState(id); return s.seen && s.due <= now; }
  function isNew(id) { return !cardState(id).seen; }
  function isLearned(id) { return cardState(id).box >= 2; }
  function rate(id, correct) {
    const s = cardState(id);
    const box = correct ? Math.min(MAX_BOX, (s.box || 0) + 1) : 1;
    progress[id] = { box, due: Date.now() + INTERVALS[box] * DAY, seen: true };
    saveProgress(progress);
  }
  function stats() {
    const now = Date.now();
    let learned = 0, due = 0, news = 0;
    for (const c of ALL_CARDS) {
      if (isNew(c.id)) news++;
      else { if (isLearned(c.id)) learned++; if (isDue(c.id, now)) due++; }
    }
    return { learned, due, news, total: ALL_CARDS.length };
  }
  function deckStats(deck) {
    let learned = 0;
    for (const c of ALL_CARDS) if (c.deckId === deck.id && isLearned(c.id)) learned++;
    return { learned, total: deck.cards.length };
  }

  // ---------- speech (Mandarin) ----------
  let zhVoice = null;
  function pickVoice() {
    if (!("speechSynthesis" in window)) return;
    const v = speechSynthesis.getVoices();
    zhVoice = v.find((x) => x.lang === "zh-CN") ||
      v.find((x) => x.lang && x.lang.toLowerCase().startsWith("zh")) || null;
  }
  if ("speechSynthesis" in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
  function speak(text) {
    if (!settings.audio || !("speechSynthesis" in window)) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(String(text));
      u.lang = "zh-CN";
      if (zhVoice) u.voice = zhVoice;
      u.rate = 0.85;
      speechSynthesis.speak(u);
    } catch {}
  }
  const speechAvailable = "speechSynthesis" in window;

  // ---------- helpers ----------
  function el(html) { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; }
  function esc(s) { return String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])); }
  function shuffle(a) { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; }
  function clear() { app.innerHTML = ""; }
  function haptic() { if (navigator.vibrate) { try { navigator.vibrate(8); } catch {} } }

  // direction: "zh-en" (front Chinese) | "en-zh" (front English) | "both"
  function resolveDir() {
    return settings.direction === "both" ? (Math.random() < 0.5 ? "zh-en" : "en-zh") : settings.direction;
  }
  function sides(dir) { return dir === "zh-en" ? ["zh", "en"] : ["en", "zh"]; }
  function tagFor(lang) { return lang === "zh" ? "中文" : "English"; }
  function faceContent(card, lang) {
    if (lang === "zh") {
      return `<div class="lang-tag">中文</div>
        <div class="word zh ${card.zh.length > 6 ? "small" : ""}">${esc(card.zh)}</div>
        <div class="pinyin">${esc(card.pin)}</div>
        ${speechAvailable ? `<button class="speak-btn zh-speak" aria-label="Speak">🔊</button>` : ""}`;
    }
    return `<div class="lang-tag">English</div>
      <div class="word ${card.en.length > 12 ? "small" : ""}">${esc(card.en)}</div>
      ${card.note ? `<div class="note">${esc(card.note)}</div>` : ""}`;
  }

  // =================================================================
  //  HOME
  // =================================================================
  function renderHome() {
    clear();
    const s = stats();
    const view = el(`<div class="fade-in"></div>`);
    view.appendChild(el(`<div class="topbar">
        <div>
          <h1>中文 🇨🇳</h1>
          <div class="subtitle">HSK 1 &amp; 2 · ${ALL_CARDS.length} words</div>
        </div>
        <button class="icon-btn" id="settingsBtn" aria-label="Settings">⚙️</button>
      </div>`));

    view.appendChild(el(`<div class="dir-switch" id="dirSwitch">
        <button data-v="zh-en" class="${settings.direction === "zh-en" ? "active" : ""}">中 → EN</button>
        <button data-v="en-zh" class="${settings.direction === "en-zh" ? "active" : ""}">EN → 中</button>
        <button data-v="both" class="${settings.direction === "both" ? "active" : ""}">Both</button>
      </div>`));

    view.appendChild(el(`<div class="stats-row">
        <div class="stat"><div class="num due">${s.due}</div><div class="lbl">Due</div></div>
        <div class="stat"><div class="num">${s.learned}</div><div class="lbl">Learned</div></div>
        <div class="stat"><div class="num">${s.news}</div><div class="lbl">New</div></div>
      </div>`));

    const learnCount = s.due + Math.min(s.news, LEARN_BATCH);
    const learnBtn = el(`<button class="cta" id="learnBtn" ${learnCount === 0 ? "disabled" : ""}>
        <span class="big-emoji">🎯</span>
        <span class="cta-text">Learn
          <span class="cta-sub">${learnCount === 0 ? "All done – come back later" : "Due reviews + new words"}</span>
        </span>
        ${learnCount > 0 ? `<span class="badge">${learnCount}</span>` : `<span class="chev">✓</span>`}
      </button>`);
    learnBtn.addEventListener("click", () => startLearn());
    view.appendChild(learnBtn);

    const quizBtn = el(`<button class="cta secondary" ${s.total < 4 ? "disabled" : ""}>
        <span class="big-emoji">🧩</span>
        <span class="cta-text">Quiz<span class="cta-sub">Multiple choice over all words</span></span>
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
      b.addEventListener("click", () => { settings.direction = b.dataset.v; saveSettings(settings); renderHome(); })
    );
  }

  // =================================================================
  //  DECK DETAIL
  // =================================================================
  function renderDeck(deck) {
    clear();
    const view = el(`<div class="fade-in"></div>`);
    view.appendChild(el(`<div class="topbar">
        <button class="back-btn" id="back">‹ Topics</button>
        <div class="icon-btn" style="margin-left:auto">${deck.icon}</div>
      </div>`));
    view.appendChild(el(`<div style="margin:0 2px 16px">
        <h1 style="margin:0;font-size:26px;letter-spacing:-0.02em">${esc(deck.name)}</h1>
        <div class="subtitle" style="font-size:14px">${esc(deck.namePt)} · ${deck.cards.length} words</div>
      </div>`));

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
            <span class="zh">${esc(c.zh)}</span> <span class="pin">${esc(c.pin)}</span><br>
            <span class="en">${esc(c.en)}${c.note ? " · " + esc(c.note) : ""}</span>
          </span>
          ${speechAvailable ? `<button class="mini-speak" aria-label="Speak">🔊</button>` : ""}
        </div>`);
      const sp = item.querySelector(".mini-speak");
      if (sp) sp.addEventListener("click", () => speak(c.zh));
      view.appendChild(item);
    }

    app.appendChild(view);
    document.getElementById("back").addEventListener("click", renderHome);
  }

  // =================================================================
  //  LEARN SESSION
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
    const total = queue.length;
    let correct = 0;
    const seenIds = new Set();
    const requeue = [];
    function step() {
      clear();
      if (idx >= queue.length) {
        if (requeue.length) { queue = requeue.splice(0); idx = 0; }
        else return renderDone(title, correct, total);
      }
      const card = queue[idx];
      renderCard(card, {
        title, index: Math.min(seenIds.size + 1, total), total,
        onRate: (ok) => {
          rate(card.id, ok);
          if (!seenIds.has(card.id)) { seenIds.add(card.id); if (ok) correct++; }
          if (!ok && !requeue.includes(card)) requeue.push(card);
          idx++; haptic(); step();
        },
        onExit: renderHome,
      });
    }
    step();
  }

  function renderCard(card, opts) {
    clear();
    const view = el(`<div class="fade-in"></div>`);
    view.appendChild(el(`<div class="topbar"><button class="back-btn" id="exit">‹ Exit</button></div>`));
    const pct = Math.round(((opts.index - 1) / opts.total) * 100);
    view.appendChild(el(`<div class="session-progress"><span style="width:${pct}%"></span></div>
        <div class="session-meta"><span>${esc(opts.title)}</span><span>${opts.index} / ${opts.total}</span></div>`));

    const dir = resolveDir();
    const [fl, bl] = sides(dir);
    const stage = el(`<div class="card-stage"></div>`);
    const flash = el(`<div class="flashcard" id="flash">
        <div class="flashcard-inner">
          <div class="face front">
            ${faceContent(card, fl)}
            <div class="tap-hint">Tap to flip</div>
          </div>
          <div class="face back">
            ${faceContent(card, bl)}
            <div class="tap-hint" style="bottom:44px">Tap to flip back</div>
            <div class="deck-chip">${card.deckIcon} ${esc(card.deckName)}</div>
          </div>
        </div>
      </div>`);
    stage.appendChild(flash);

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
      answers.appendChild(again); answers.appendChild(good);
    }
    function reveal() {
      if (!revealed) { revealed = true; showRatingButtons(); }
      flash.classList.add("flipped");
      speak(card.zh);
    }
    function toggleFlip() {
      if (!revealed) return reveal();
      flash.classList.toggle("flipped");
      if (flash.classList.contains("flipped")) speak(card.zh);
    }
    flash.addEventListener("click", (e) => { if (e.target.closest(".speak-btn")) return; toggleFlip(); });
    document.getElementById("reveal").addEventListener("click", reveal);
    flash.querySelectorAll(".zh-speak").forEach((b) =>
      b.addEventListener("click", (e) => { e.stopPropagation(); speak(card.zh); })
    );
    document.getElementById("exit").addEventListener("click", opts.onExit);
    if (fl === "zh") speak(card.zh);
  }

  function renderDone(title, correct, total) {
    clear();
    const pct = total ? Math.round((correct / total) * 100) : 100;
    const emoji = pct >= 90 ? "🏆" : pct >= 60 ? "🎉" : "💪";
    const view = el(`<div class="fade-in">
        <div class="done-card">
          <div class="emoji">${emoji}</div>
          <h2>做得好! (Well done!)</h2>
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
  //  QUIZ
  // =================================================================
  function startQuiz(pool, title) {
    pool = pool || ALL_CARDS;
    title = title || "Quiz";
    if (pool.length < 4) { alert("The quiz needs at least 4 words."); return renderHome(); }
    const questions = shuffle(pool).slice(0, Math.min(10, pool.length));
    let idx = 0, correct = 0;
    function step() {
      if (idx >= questions.length) return renderDone(title, correct, questions.length);
      renderQuizQuestion(questions[idx], pool, {
        title, index: idx + 1, total: questions.length,
        onAnswer: (ok) => { rate(questions[idx].id, ok); if (ok) correct++; idx++; },
        next: step, exit: renderHome,
      });
    }
    step();
  }

  function optLabel(card, lang) {
    return lang === "zh"
      ? `<span><span class="zh-opt">${esc(card.zh)}</span><span class="pin-opt">${esc(card.pin)}</span></span>`
      : `<span>${esc(card.en)}</span>`;
  }

  function renderQuizQuestion(card, pool, opts) {
    clear();
    const dir = resolveDir();
    const [fl, bl] = sides(dir);
    const distractors = shuffle(pool.filter((c) => c.id !== card.id)).slice(0, 3);
    const options = shuffle([card, ...distractors]);

    const view = el(`<div class="fade-in"></div>`);
    view.appendChild(el(`<div class="topbar"><button class="back-btn" id="exit">‹ Exit</button></div>`));
    const pct = Math.round(((opts.index - 1) / opts.total) * 100);
    view.appendChild(el(`<div class="session-progress"><span style="width:${pct}%"></span></div>
        <div class="session-meta"><span>${esc(opts.title)}</span><span>${opts.index} / ${opts.total}</span></div>`));

    const promptInner = fl === "zh"
      ? `<div class="word zh">${esc(card.zh)}</div><div class="pinyin">${esc(card.pin)}</div>`
      : `<div class="word">${esc(card.en)}</div>`;
    view.appendChild(el(`<div class="quiz-prompt">
        <div class="lang-tag">${tagFor(fl)} → ${tagFor(bl)}</div>
        ${promptInner}
      </div>`));

    const optWrap = el(`<div class="quiz-options"></div>`);
    const buttons = [];
    options.forEach((o) => {
      const b = el(`<button class="quiz-opt">${optLabel(o, bl)}<span class="mark"></span></button>`);
      b.addEventListener("click", () => choose(o, b));
      buttons.push({ card: o, btn: b });
      optWrap.appendChild(b);
    });
    view.appendChild(optWrap);
    app.appendChild(view);
    if (fl === "zh") speak(card.zh);

    let answered = false;
    function choose(chosen, btn) {
      if (answered) return;
      answered = true; haptic();
      const ok = chosen.id === card.id;
      buttons.forEach(({ card: c, btn: b }) => {
        if (c.id === card.id) { b.classList.add("correct"); b.querySelector(".mark").textContent = "✓"; }
        else if (b === btn) { b.classList.add("wrong"); b.querySelector(".mark").textContent = "✗"; }
        else b.classList.add("dim");
      });
      speak(card.zh);
      opts.onAnswer(ok);
      const contRow = el(`<div class="answer-row single" style="margin-top:18px"><button class="ans good">Continue ›</button></div>`);
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

    const dirGroup = el(`<div class="setting-group">
        <div class="setting-row">
          <div>Direction<div class="desc">What's on the front of the card?</div></div>
          <div class="seg" id="dirSeg">
            <button data-v="zh-en" class="${settings.direction === "zh-en" ? "active" : ""}">中→EN</button>
            <button data-v="en-zh" class="${settings.direction === "en-zh" ? "active" : ""}">EN→中</button>
            <button data-v="both" class="${settings.direction === "both" ? "active" : ""}">Both</button>
          </div>
        </div>
      </div>`);
    view.appendChild(dirGroup);

    const miscGroup = el(`<div class="setting-group">
        <div class="setting-row">
          <div>Pronunciation ${speechAvailable ? "<div class='desc'>Read Mandarin aloud automatically</div>" : "<div class='desc'>Not available on this device</div>"}</div>
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
    view.appendChild(el(`<div class="install-tip">💡 <b>Install as an app:</b> in Safari, tap the Share icon
      and choose “Add to Home Screen”. It then opens like a real app – and works offline.</div>`));

    app.appendChild(view);
    document.getElementById("back").addEventListener("click", renderHome);
    dirGroup.querySelectorAll("#dirSeg button").forEach((b) =>
      b.addEventListener("click", () => { settings.direction = b.dataset.v; saveSettings(settings); renderSettings(); }));
    miscGroup.querySelectorAll("#themeSeg button").forEach((b) =>
      b.addEventListener("click", () => { settings.theme = b.dataset.v; saveSettings(settings); applyTheme(); renderSettings(); }));
    const sw = document.getElementById("audioSw");
    if (speechAvailable) sw.addEventListener("click", () => { settings.audio = !settings.audio; saveSettings(settings); sw.classList.toggle("on", settings.audio); });
    reset.addEventListener("click", () => {
      if (confirm("Really delete all your progress? This can't be undone.")) { progress = {}; saveProgress(progress); renderHome(); }
    });
  }

  // ---------- service worker ----------
  if ("serviceWorker" in navigator) {
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!hadController || reloaded) return; reloaded = true; location.reload();
    });
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then((r) => r.update()).catch(() => {});
    });
  }

  document.addEventListener("touchstart", function unlock() {
    if (speechAvailable && settings.audio) { try { speechSynthesis.speak(new SpeechSynthesisUtterance("")); } catch {} }
    document.removeEventListener("touchstart", unlock);
  }, { once: true, passive: true });

  renderHome();
})();
