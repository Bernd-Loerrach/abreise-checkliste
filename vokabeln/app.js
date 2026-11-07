/* Português A1 – Vocabulary Trainer
   Each word is studied in BOTH directions (PT→EN and EN→PT) as its own card.
   You recall the answer from memory and type it in; spelling is checked (accents
   are forgiven with a gentle note). Each card has its own growing review schedule
   (spaced repetition). Progress is stored per device in localStorage. */

(() => {
  "use strict";

  const STORE_KEY = "pt-vocab-v1";
  const SETTINGS_KEY = "pt-vocab-settings-v1";

  // Leitner intervals in days per box level. Box 0 = new/unknown.
  const INTERVALS = [0, 1, 3, 7, 16, 35, 90];
  const MAX_BOX = INTERVALS.length - 1;
  const LEARN_BATCH = 10; // new cards introduced per "Learn" session

  const DAY = 24 * 60 * 60 * 1000;
  const app = document.getElementById("app");

  // ---------- Study items: two per word ----------
  // e = show Portuguese, type English.  p = show English, type Portuguese.
  const ITEMS = [];
  for (const c of ALL_CARDS) {
    ITEMS.push({ key: c.id + "|e", card: c, promptLang: "Português", answerLang: "English",
      prompt: c.pt, answer: c.en, speakPrompt: true,
      deckId: c.deckId, deckName: c.deckName, deckIcon: c.deckIcon });
    ITEMS.push({ key: c.id + "|p", card: c, promptLang: "English", answerLang: "Português",
      prompt: c.en, answer: c.pt, speakPrompt: false,
      deckId: c.deckId, deckName: c.deckName, deckIcon: c.deckIcon });
  }
  const ITEMS_BY_CARD = {};
  for (const it of ITEMS) (ITEMS_BY_CARD[it.card.id] = ITEMS_BY_CARD[it.card.id] || []).push(it);

  // ---------- Load/save state ----------
  function loadProgress() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; }
  }
  function saveProgress(p) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(p)); } catch {}
  }
  function loadSettings() {
    let s = {};
    try { s = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch {}
    return Object.assign({ audio: true, theme: "auto" }, s);
  }
  function saveSettings(s) {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch {}
  }

  let progress = loadProgress();
  let settings = loadSettings();
  applyTheme();

  function applyTheme() {
    if (settings.theme === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", settings.theme);
  }

  // ---------- SRS helpers (per study item) ----------
  function st(key) { return progress[key] || { box: 0, due: 0, seen: false }; }
  function isDue(key, now) { const s = st(key); return s.seen && s.due <= now; }
  function isNew(key) { return !st(key).seen; }
  function isLearned(key) { return st(key).box >= 2; }

  function rate(key, correct) {
    const s = st(key);
    const box = correct ? Math.min(MAX_BOX, (s.box || 0) + 1) : 1;
    progress[key] = { box, due: Date.now() + INTERVALS[box] * DAY, seen: true };
    saveProgress(progress);
  }

  // ---------- Statistics (counted over words / cards) ----------
  function stats() {
    const now = Date.now();
    let learned = 0, due = 0, news = 0;
    for (const c of ALL_CARDS) {
      const ks = ITEMS_BY_CARD[c.id].map((i) => i.key);
      if (ks.every((k) => isNew(k))) news++;
      if (ks.every((k) => isLearned(k))) learned++;
      for (const k of ks) if (isDue(k, now)) due++;
    }
    return { learned, due, news, total: ALL_CARDS.length };
  }
  function deckStats(deck) {
    let learned = 0;
    for (const c of ALL_CARDS) {
      if (c.deckId !== deck.id) continue;
      if (ITEMS_BY_CARD[c.id].every((i) => isLearned(i.key))) learned++;
    }
    return { learned, total: deck.cards.length };
  }

  // ---------- Text-to-speech (European Portuguese) ----------
  let ptVoice = null;
  function pickVoice() {
    if (!("speechSynthesis" in window)) return;
    const voices = speechSynthesis.getVoices();
    ptVoice = voices.find((v) => v.lang === "pt-PT") ||
      voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("pt")) || null;
  }
  if ("speechSynthesis" in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
  function speak(text) {
    if (!settings.audio || !("speechSynthesis" in window)) return;
    const clean = String(text).replace(/^\([^)]*\)\s*/, ""); // drop "(o) " marker
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

  // ---------- Answer checking ----------
  function deaccent(s) { return s.normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  function normStrict(s) {
    return s.toLowerCase().trim().replace(/[.!?¿¡"'’]/g, "").replace(/\s+/g, " ");
  }
  function normLoose(s) { return deaccent(normStrict(s)); }
  function stripLead(s) { return s.replace(/^(os|as|o|a|um|uma|the|an|to)\s+/i, ""); }

  // Build the set of acceptable spellings for a target answer.
  function variantsOf(target) {
    const set = new Set();
    const parts = target.split(/[,;/]|\bor\b/i).map((x) => x.trim()).filter(Boolean);
    parts.push(target);
    for (const p of parts) {
      const forms = [
        p,
        p.replace(/^\([^)]*\)\s*/, ""),                         // drop leading (marker)
        p.replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim(), // drop parentheticals
        p.replace(/[()]/g, "").replace(/\s+/g, " ").trim(),      // keep text, drop brackets
      ];
      for (let f of forms) {
        f = f.trim();
        if (f) set.add(f);
        const s2 = stripLead(f).trim();
        if (s2) set.add(s2);
      }
    }
    return [...set];
  }
  // returns 'correct' | 'accent' | 'wrong'
  function judge(input, target) {
    const u = input.trim();
    if (!u) return "wrong";
    const vs = variantsOf(target);
    const us = normStrict(u), ul = normLoose(u);
    if (vs.some((v) => normStrict(v) === us)) return "correct";
    if (vs.some((v) => normLoose(v) === ul)) return "accent";
    return "wrong";
  }

  // ---------- DOM helpers ----------
  function el(html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  }
  function shuffle(a) {
    const r = a.slice();
    for (let i = r.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [r[i], r[j]] = [r[j], r[i]];
    }
    return r;
  }
  function clear() { app.innerHTML = ""; }
  function haptic() { if (navigator.vibrate) { try { navigator.vibrate(8); } catch {} } }

  // =================================================================
  //  HOME
  // =================================================================
  function renderHome() {
    clear();
    const s = stats();
    const view = el(`<div class="fade-in"></div>`);
    view.appendChild(el(`<div class="topbar">
        <div>
          <h1>Português 🇵🇹</h1>
          <div class="subtitle">${ALL_CARDS.length} words · type both ways</div>
        </div>
        <button class="icon-btn" id="settingsBtn" aria-label="Settings">⚙️</button>
      </div>`));

    view.appendChild(el(`<div class="stats-row">
        <div class="stat"><div class="num due">${s.due}</div><div class="lbl">Due</div></div>
        <div class="stat"><div class="num">${s.learned}</div><div class="lbl">Learned</div></div>
        <div class="stat"><div class="num">${s.news}</div><div class="lbl">New</div></div>
      </div>`));

    const learnCount = s.due + Math.min(s.news * 2, LEARN_BATCH);
    const learnBtn = el(`<button class="cta" id="learnBtn" ${learnCount === 0 ? "disabled" : ""}>
        <span class="big-emoji">⌨️</span>
        <span class="cta-text">Learn
          <span class="cta-sub">${learnCount === 0 ? "All done – come back later" : "Type the answer from memory"}</span>
        </span>
        ${learnCount > 0 ? `<span class="badge">${learnCount}</span>` : `<span class="chev">✓</span>`}
      </button>`);
    learnBtn.addEventListener("click", () => startLearn());
    view.appendChild(learnBtn);

    const quizBtn = el(`<button class="cta secondary" id="quizBtn">
        <span class="big-emoji">🧩</span>
        <span class="cta-text">Quiz
          <span class="cta-sub">Quick multiple-choice, both directions</span>
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
            <span class="deck-pt">${esc(deck.namePt)} · ${ds.learned}/${ds.total} learned</span>
            <span class="progress-bar"><span style="width:${pct}%"></span></span>
          </span>
          <span class="deck-right"><span class="chev">›</span></span>
        </button>`);
      d.addEventListener("click", () => renderDeck(deck));
      view.appendChild(d);
    }

    app.appendChild(view);
    document.getElementById("settingsBtn").addEventListener("click", renderSettings);
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
        <div class="subtitle" style="font-size:14px">${deck.cards.length} words starting with “${esc(deck.icon)}”</div>
      </div>`));

    const deckItems = ITEMS.filter((i) => i.deckId === deck.id);

    const learnBtn = el(`<button class="cta">
        <span class="big-emoji">⌨️</span>
        <span class="cta-text">Learn this topic<span class="cta-sub">Type all ${deck.cards.length} words, both ways</span></span>
        <span class="chev">›</span>
      </button>`);
    learnBtn.addEventListener("click", () => startSession(shuffle(deckItems), "Learn: " + deck.name));
    view.appendChild(learnBtn);

    const quizBtn = el(`<button class="cta secondary">
        <span class="big-emoji">🧩</span>
        <span class="cta-text">Quiz this topic<span class="cta-sub">Multiple choice</span></span>
        <span class="chev">›</span>
      </button>`);
    quizBtn.addEventListener("click", () => startQuiz(deckItems, "Quiz: " + deck.name));
    view.appendChild(quizBtn);

    view.appendChild(el(`<div class="section-title">All words</div>`));
    for (const c of ALL_CARDS.filter((c) => c.deckId === deck.id)) {
      const learned = ITEMS_BY_CARD[c.id].every((i) => isLearned(i.key));
      const item = el(`<div class="browse-item">
          <span class="box-dot ${learned ? "learned" : ""}"></span>
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
  //  LEARN SESSION (typed recall, spaced repetition)
  // =================================================================
  function startLearn() {
    const now = Date.now();
    const due = ITEMS.filter((i) => isDue(i.key, now));
    const news = ITEMS.filter((i) => isNew(i.key)).slice(0, LEARN_BATCH);
    const queue = shuffle(due).concat(shuffle(news));
    if (queue.length === 0) return renderHome();
    startSession(queue, "Learn");
  }

  function startSession(queue, title) {
    let idx = 0;
    const total = queue.length;
    let correct = 0;
    const seen = new Set();
    const requeue = [];

    function step() {
      clear();
      if (idx >= queue.length) {
        if (requeue.length) { queue = requeue.splice(0); idx = 0; }
        else return renderDone(title, correct, total);
      }
      const item = queue[idx];
      renderTypedCard(item, {
        title,
        index: Math.min(seen.size + 1, total),
        total,
        onDone: (ok) => {
          rate(item.key, ok);
          if (!seen.has(item.key)) { seen.add(item.key); if (ok) correct++; }
          if (!ok && !requeue.includes(item)) requeue.push(item);
          idx++;
          step();
        },
        onExit: renderHome,
      });
    }
    step();
  }

  function renderTypedCard(item, opts) {
    clear();
    const view = el(`<div class="fade-in"></div>`);
    view.appendChild(el(`<div class="topbar"><button class="back-btn" id="exit">‹ Exit</button></div>`));
    const pct = Math.round(((opts.index - 1) / opts.total) * 100);
    view.appendChild(el(`<div class="session-progress"><span style="width:${pct}%"></span></div>
        <div class="session-meta"><span>${esc(opts.title)}</span><span>${opts.index} / ${opts.total}</span></div>`));

    view.appendChild(el(`<div class="quiz-prompt">
        <div class="lang-tag">${item.promptLang} → ${item.answerLang}</div>
        <div class="word">${esc(item.prompt)}</div>
        ${item.speakPrompt && speechAvailable ? `<button class="speak-btn" id="sp" aria-label="Speak" style="margin-top:14px">🔊</button>` : ""}
      </div>`));

    const input = el(`<input class="type-input" id="inp" type="text" autocapitalize="off"
        autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="done"
        placeholder="Type the ${item.answerLang === "Português" ? "Portuguese" : "English"} word…">`);
    view.appendChild(input);
    const fb = el(`<div id="fb"></div>`);
    view.appendChild(fb);
    const actions = el(`<div class="answer-row single" id="act" style="margin-top:16px">
        <button class="ans good" id="check">Check</button></div>`);
    view.appendChild(actions);
    app.appendChild(view);

    const sp = document.getElementById("sp");
    if (sp) sp.addEventListener("click", () => speak(item.card.pt));
    if (item.speakPrompt) speak(item.card.pt);
    try { input.focus(); } catch {}

    let done = false;
    let proceed = null;

    function submit() {
      if (done) return;
      const val = input.value;
      if (!val.trim()) { try { input.focus(); } catch {} return; }
      done = true;
      const res = judge(val, item.answer);
      const ok = res !== "wrong";
      input.classList.add(ok ? "ok" : "no");
      input.disabled = true;
      speak(item.card.pt);
      haptic();

      if (res === "correct") {
        fb.innerHTML = `<div class="feedback correct">✓ Correct<div class="ans-word">${esc(item.answer)}</div></div>`;
      } else if (res === "accent") {
        fb.innerHTML = `<div class="feedback accent">✓ Almost – watch the spelling<div class="ans-word">${esc(item.answer)}</div></div>`;
      } else {
        fb.innerHTML = `<div class="feedback wrong">✗ Not quite<div class="ans-word">${esc(item.answer)}</div><div class="yours">you typed: ${esc(val)}</div></div>`;
      }
      if (item.card.note) fb.firstChild.appendChild(el(`<div class="yours">${esc(item.card.note)}</div>`));

      actions.innerHTML = "";
      proceed = () => opts.onDone(ok);
      if (ok) {
        actions.classList.add("single");
        const cont = el(`<button class="ans good">Continue</button>`);
        cont.addEventListener("click", () => opts.onDone(true));
        actions.appendChild(cont);
      } else {
        actions.classList.remove("single");
        const iwr = el(`<button class="ans again">I was right</button>`);
        const cont = el(`<button class="ans good">Continue</button>`);
        iwr.addEventListener("click", () => opts.onDone(true));
        cont.addEventListener("click", () => opts.onDone(false));
        actions.appendChild(iwr);
        actions.appendChild(cont);
      }
    }

    document.getElementById("check").addEventListener("click", submit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); if (!done) submit(); else if (proceed) proceed(); }
    });
    document.getElementById("exit").addEventListener("click", opts.onExit);
  }

  function renderDone(title, correct, total) {
    clear();
    const pct = total ? Math.round((correct / total) * 100) : 100;
    const emoji = pct >= 90 ? "🏆" : pct >= 60 ? "🎉" : "💪";
    const view = el(`<div class="fade-in">
        <div class="done-card">
          <div class="emoji">${emoji}</div>
          <h2>Well done!</h2>
          <p>${correct} of ${total} right (${pct}%)</p>
          <button class="cta" id="home" style="justify-content:center">
            <span class="cta-text" style="text-align:center;flex:none">Back to home</span>
          </button>
        </div>
      </div>`);
    app.appendChild(view);
    document.getElementById("home").addEventListener("click", renderHome);
  }

  // =================================================================
  //  QUIZ (multiple choice, random direction)
  // =================================================================
  function startQuiz(pool, title) {
    pool = pool || ITEMS;
    title = title || "Quiz";
    if (pool.length < 4) { alert("The quiz needs at least 4 words."); return renderHome(); }
    const questions = shuffle(pool).slice(0, Math.min(10, pool.length));
    let idx = 0, correct = 0;
    function step() {
      if (idx >= questions.length) return renderDone(title, correct, questions.length);
      renderQuizQuestion(questions[idx], pool, {
        title, index: idx + 1, total: questions.length,
        onAnswer: (ok) => { rate(questions[idx].key, ok); if (ok) correct++; idx++; },
        next: step, exit: renderHome,
      });
    }
    step();
  }

  function renderQuizQuestion(item, pool, opts) {
    clear();
    const sameDir = pool.filter((i) => i.answerLang === item.answerLang && i.card.id !== item.card.id);
    const distractors = shuffle(sameDir).slice(0, 3);
    const options = shuffle([item, ...distractors]);

    const view = el(`<div class="fade-in"></div>`);
    view.appendChild(el(`<div class="topbar"><button class="back-btn" id="exit">‹ Exit</button></div>`));
    const pct = Math.round(((opts.index - 1) / opts.total) * 100);
    view.appendChild(el(`<div class="session-progress"><span style="width:${pct}%"></span></div>
        <div class="session-meta"><span>${esc(opts.title)}</span><span>${opts.index} / ${opts.total}</span></div>`));
    view.appendChild(el(`<div class="quiz-prompt">
        <div class="lang-tag">${item.promptLang} → ${item.answerLang}</div>
        <div class="word">${esc(item.prompt)}</div>
      </div>`));

    const optWrap = el(`<div class="quiz-options"></div>`);
    const buttons = [];
    options.forEach((o) => {
      const b = el(`<button class="quiz-opt"><span>${esc(o.answer)}</span><span class="mark"></span></button>`);
      b.addEventListener("click", () => choose(o, b));
      buttons.push({ item: o, btn: b });
      optWrap.appendChild(b);
    });
    view.appendChild(optWrap);
    app.appendChild(view);

    if (item.speakPrompt) speak(item.card.pt);

    let answered = false;
    function choose(chosen, btn) {
      if (answered) return;
      answered = true;
      haptic();
      const ok = chosen.key === item.key;
      buttons.forEach(({ item: it, btn: b }) => {
        if (it.key === item.key) { b.classList.add("correct"); b.querySelector(".mark").textContent = "✓"; }
        else if (b === btn) { b.classList.add("wrong"); b.querySelector(".mark").textContent = "✗"; }
        else b.classList.add("dim");
      });
      speak(item.card.pt);
      opts.onAnswer(ok);
      setTimeout(opts.next, ok ? 750 : 1400);
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

    view.appendChild(el(`<div class="install-tip">Every word is practised <b>both ways</b> — Portuguese→English and
      English→Portuguese — as two separate cards. You <b>type</b> the answer from memory; accents are
      forgiven with a reminder. Each card comes back on its own growing schedule.</div>`));

    const reset = el(`<button class="danger-btn" id="reset" style="margin-top:16px">Reset progress</button>`);
    view.appendChild(reset);

    view.appendChild(el(`<div class="install-tip">💡 <b>Install as an app:</b> in Safari, tap the Share icon
      and choose “Add to Home Screen”. It then opens like a real app – and works offline.</div>`));

    app.appendChild(view);
    document.getElementById("back").addEventListener("click", renderHome);
    miscGroup.querySelectorAll("#themeSeg button").forEach((b) =>
      b.addEventListener("click", () => {
        settings.theme = b.dataset.v; saveSettings(settings); applyTheme(); renderSettings();
      }));
    const sw = document.getElementById("audioSw");
    if (speechAvailable) sw.addEventListener("click", () => {
      settings.audio = !settings.audio; saveSettings(settings); sw.classList.toggle("on", settings.audio);
    });
    reset.addEventListener("click", () => {
      if (confirm("Really delete all your progress? This can't be undone.")) {
        progress = {}; saveProgress(progress); renderHome();
      }
    });
  }

  // ---------- Service worker ----------
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => {}); });
  }

  // iOS Safari: unlock audio after the first gesture
  document.addEventListener("touchstart", function unlock() {
    if (speechAvailable && settings.audio) {
      try { speechSynthesis.speak(new SpeechSynthesisUtterance("")); } catch {}
    }
    document.removeEventListener("touchstart", unlock);
  }, { once: true, passive: true });

  renderHome();
})();
