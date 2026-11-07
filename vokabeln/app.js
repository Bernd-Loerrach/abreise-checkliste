/* Português A1 – Vokabeltrainer
   Einzeldatei-Logik: Router + Lernen (Spaced Repetition) + Quiz + Durchblättern + Einstellungen.
   Fortschritt wird pro Gerät in localStorage gespeichert. */

(() => {
  "use strict";

  const STORE_KEY = "pt-vocab-v1";
  const SETTINGS_KEY = "pt-vocab-settings-v1";

  // Leitner-Intervalle in Tagen je Box-Stufe. Box 0 = neu/unbekannt.
  const INTERVALS = [0, 1, 3, 7, 16, 35, 90];
  const MAX_BOX = INTERVALS.length - 1;
  const LEARN_BATCH = 10; // neue Karten pro "Lernen"-Sitzung

  const DAY = 24 * 60 * 60 * 1000;
  const app = document.getElementById("app");

  // ---------- Zustand laden/speichern ----------
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
    return Object.assign({ direction: "pt-de", audio: true, theme: "auto" }, s);
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

  // ---------- SRS-Helfer ----------
  function cardState(id) {
    return progress[id] || { box: 0, due: 0, seen: false };
  }
  function isDue(id, now) {
    const st = cardState(id);
    if (!st.seen) return false; // ungesehene sind "neu", nicht "fällig"
    return st.due <= now;
  }
  function isNew(id) {
    return !cardState(id).seen;
  }
  function isLearned(id) {
    return cardState(id).box >= 2; // ab Box 2 gilt als gelernt
  }

  function rate(id, correct) {
    const st = cardState(id);
    let box;
    if (correct) box = Math.min(MAX_BOX, (st.box || 0) + 1);
    else box = 1; // zurück auf Box 1
    const due = Date.now() + INTERVALS[box] * DAY;
    progress[id] = { box, due, seen: true };
    saveProgress(progress);
  }

  // ---------- Statistiken ----------
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

  // ---------- Text-to-Speech (europäisches Portugiesisch) ----------
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
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "pt-PT";
      if (ptVoice) u.voice = ptVoice;
      u.rate = 0.9;
      speechSynthesis.speak(u);
    } catch {}
  }
  const speechAvailable = "speechSynthesis" in window;

  // ---------- kleine DOM-Helfer ----------
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

  // Front/Back je nach Richtung
  function front(card) {
    return settings.direction === "pt-de" ? card.pt : card.de;
  }
  function back(card) {
    return settings.direction === "pt-de" ? card.de : card.pt;
  }
  function frontLang(card) {
    return settings.direction === "pt-de" ? "Português" : "Deutsch";
  }
  function backLang(card) {
    return settings.direction === "pt-de" ? "Deutsch" : "Português";
  }

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
          <div class="subtitle">Vokabeln A1 lernen</div>
        </div>
        <button class="icon-btn" id="settingsBtn" aria-label="Einstellungen">⚙️</button>
      </div>`)
    );

    view.appendChild(
      el(`<div class="stats-row">
        <div class="stat"><div class="num due">${s.due}</div><div class="lbl">Fällig</div></div>
        <div class="stat"><div class="num">${s.learned}</div><div class="lbl">Gelernt</div></div>
        <div class="stat"><div class="num">${s.news}</div><div class="lbl">Neu</div></div>
      </div>`)
    );

    // Lernen (fällige + neue Karten)
    const learnCount = s.due + Math.min(s.news, LEARN_BATCH);
    const learnBtn = el(`<button class="cta" id="learnBtn" ${learnCount === 0 ? "disabled" : ""}>
        <span class="big-emoji">🎯</span>
        <span class="cta-text">Lernen
          <span class="cta-sub">${
            learnCount === 0 ? "Alles erledigt – komm später wieder" : "Fällige Wiederholungen + neue Wörter"
          }</span>
        </span>
        ${learnCount > 0 ? `<span class="badge">${learnCount}</span>` : `<span class="chev">✓</span>`}
      </button>`);
    learnBtn.addEventListener("click", () => startLearn());
    view.appendChild(learnBtn);

    const quizBtn = el(`<button class="cta secondary" id="quizBtn" ${
      s.total - s.news < 4 && s.total < 4 ? "disabled" : ""
    }>
        <span class="big-emoji">🧩</span>
        <span class="cta-text">Quiz
          <span class="cta-sub">Multiple-Choice über alle Wörter</span>
        </span>
        <span class="chev">›</span>
      </button>`);
    quizBtn.addEventListener("click", () => startQuiz());
    view.appendChild(quizBtn);

    view.appendChild(el(`<div class="section-title">Themen</div>`));
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
  }

  // =================================================================
  //  DECK-DETAIL (Themenübersicht + Lernen/Quiz dieses Themas)
  // =================================================================
  function renderDeck(deck) {
    clear();
    const view = el(`<div class="fade-in"></div>`);
    view.appendChild(
      el(`<div class="topbar">
        <button class="back-btn" id="back">‹ Themen</button>
        <div class="icon-btn" style="margin-left:auto">${deck.icon}</div>
      </div>`)
    );
    view.appendChild(
      el(`<div style="margin:0 2px 16px">
        <h1 style="margin:0;font-size:26px;letter-spacing:-0.02em">${esc(deck.name)}</h1>
        <div class="subtitle" style="font-size:14px">${esc(deck.namePt)} · ${deck.cards.length} Wörter</div>
      </div>`)
    );

    const deckCards = ALL_CARDS.filter((c) => c.deckId === deck.id);

    const learnBtn = el(`<button class="cta">
        <span class="big-emoji">🎯</span>
        <span class="cta-text">Dieses Thema lernen<span class="cta-sub">Alle ${deck.cards.length} Wörter üben</span></span>
        <span class="chev">›</span>
      </button>`);
    learnBtn.addEventListener("click", () => startSession(shuffle(deckCards), "Lernen: " + deck.name));
    view.appendChild(learnBtn);

    const quizBtn = el(`<button class="cta secondary">
        <span class="big-emoji">🧩</span>
        <span class="cta-text">Quiz zu diesem Thema<span class="cta-sub">Multiple-Choice</span></span>
        <span class="chev">›</span>
      </button>`);
    quizBtn.addEventListener("click", () => startQuiz(deckCards, "Quiz: " + deck.name));
    view.appendChild(quizBtn);

    view.appendChild(el(`<div class="section-title">Alle Wörter</div>`));
    for (const c of deckCards) {
      const item = el(`<div class="browse-item">
          <span class="box-dot ${isLearned(c.id) ? "learned" : ""}"></span>
          <span>
            <span class="pt">${esc(c.pt)}</span><br>
            <span class="de">${esc(c.de)}${c.note ? " · " + esc(c.note) : ""}</span>
          </span>
          ${speechAvailable ? `<button class="mini-speak" aria-label="Aussprechen">🔊</button>` : ""}
        </div>`);
      const sp = item.querySelector(".mini-speak");
      if (sp) sp.addEventListener("click", () => speak(c.pt));
      view.appendChild(item);
    }

    app.appendChild(view);
    document.getElementById("back").addEventListener("click", renderHome);
  }

  // =================================================================
  //  LERN-SITZUNG (Karteikarten mit SRS)
  // =================================================================
  function startLearn() {
    const now = Date.now();
    const due = ALL_CARDS.filter((c) => isDue(c.id, now));
    const news = ALL_CARDS.filter((c) => isNew(c.id)).slice(0, LEARN_BATCH);
    const queue = shuffle(due).concat(news);
    if (queue.length === 0) return renderHome();
    startSession(queue, "Lernen");
  }

  function startSession(queue, title) {
    let idx = 0;
    const total = queue.length; // Zahl der eindeutigen Wörter
    let correct = 0; // eindeutige Wörter, die (irgendwann) gewusst wurden
    const seenIds = new Set();
    const requeue = []; // falsch beantwortete am Ende nochmal

    function step() {
      clear();
      // Warteschlange leer? -> evtl. falsche nochmal, sonst fertig
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
        <button class="back-btn" id="exit">‹ Beenden</button>
      </div>`)
    );

    const pct = Math.round((opts.index - 1) / opts.total * 100);
    view.appendChild(
      el(`<div class="session-progress"><span style="width:${pct}%"></span></div>
          <div class="session-meta"><span>${esc(opts.title)}</span><span>${opts.index} / ${opts.total}</span></div>`)
    );

    const stage = el(`<div class="card-stage"></div>`);
    const fWord = front(card);
    const bWord = back(card);
    const flash = el(`<div class="flashcard" id="flash">
        <div class="flashcard-inner">
          <div class="face front">
            <div class="lang-tag">${frontLang(card)}</div>
            <div class="word ${fWord.length > 12 ? "small" : ""}">${esc(fWord)}</div>
            ${
              settings.direction === "pt-de" && speechAvailable
                ? `<button class="speak-btn" id="speakFront" aria-label="Aussprechen">🔊</button>`
                : ""
            }
            <div class="tap-hint">Tippen zum Umdrehen</div>
          </div>
          <div class="face back">
            <div class="lang-tag">${backLang(card)}</div>
            <div class="word ${bWord.length > 12 ? "small" : ""}">${esc(bWord)}</div>
            ${card.note ? `<div class="note">${esc(card.note)}</div>` : ""}
            ${
              settings.direction === "de-pt" && speechAvailable
                ? `<button class="speak-btn" id="speakBack" aria-label="Aussprechen">🔊</button>`
                : ""
            }
            <div class="deck-chip">${card.deckIcon} ${esc(card.deckName)}</div>
          </div>
        </div>
      </div>`);
    stage.appendChild(flash);

    // Antwortbereich (erst nach dem Umdrehen aktiv)
    const answers = el(`<div class="answer-row single" id="answers">
        <button class="ans reveal" id="reveal">Antwort zeigen</button>
      </div>`);
    stage.appendChild(answers);
    view.appendChild(stage);
    app.appendChild(view);

    let flipped = false;
    function flip() {
      if (flipped) return;
      flipped = true;
      flash.classList.add("flipped");
      // Beim Aufdecken PT automatisch vorlesen
      speak(card.pt);
      answers.classList.remove("single");
      answers.innerHTML = "";
      const again = el(`<button class="ans again">✗ Noch nicht</button>`);
      const good = el(`<button class="ans good">✓ Gewusst</button>`);
      again.addEventListener("click", () => opts.onRate(false));
      good.addEventListener("click", () => opts.onRate(true));
      answers.appendChild(again);
      answers.appendChild(good);
    }

    flash.addEventListener("click", (e) => {
      if (e.target.closest(".speak-btn")) return; // Lautsprecher nicht als Flip werten
      flip();
    });
    document.getElementById("reveal").addEventListener("click", flip);

    const sf = document.getElementById("speakFront");
    if (sf) sf.addEventListener("click", (e) => { e.stopPropagation(); speak(card.pt); });
    const sb = document.getElementById("speakBack");
    if (sb) sb.addEventListener("click", (e) => { e.stopPropagation(); speak(card.pt); });

    document.getElementById("exit").addEventListener("click", opts.onExit);

    // PT-Front gleich einmal vorlesen
    if (settings.direction === "pt-de") speak(card.pt);
  }

  function renderDone(title, correct, total) {
    clear();
    const pct = total ? Math.round((correct / total) * 100) : 100;
    const emoji = pct >= 90 ? "🏆" : pct >= 60 ? "🎉" : "💪";
    const view = el(`<div class="fade-in">
        <div class="done-card">
          <div class="emoji">${emoji}</div>
          <h2>Geschafft!</h2>
          <p>${correct} von ${total} gewusst (${pct}%)</p>
          <button class="cta" id="home" style="justify-content:center">
            <span class="cta-text" style="text-align:center;flex:none">Zurück zur Übersicht</span>
          </button>
        </div>
      </div>`);
    app.appendChild(view);
    document.getElementById("home").addEventListener("click", renderHome);
  }

  // =================================================================
  //  QUIZ (Multiple Choice)
  // =================================================================
  function startQuiz(pool, title) {
    pool = pool || ALL_CARDS;
    title = title || "Quiz";
    if (pool.length < 4) {
      alert("Für das Quiz werden mindestens 4 Wörter gebraucht.");
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
    // Ask in back-language; options are back-side values.
    const distractors = shuffle(pool.filter((c) => c.id !== card.id)).slice(0, 3);
    const options = shuffle([card, ...distractors]);

    const view = el(`<div class="fade-in"></div>`);
    view.appendChild(el(`<div class="topbar"><button class="back-btn" id="exit">‹ Beenden</button></div>`));
    const pct = Math.round(((opts.index - 1) / opts.total) * 100);
    view.appendChild(
      el(`<div class="session-progress"><span style="width:${pct}%"></span></div>
          <div class="session-meta"><span>${esc(opts.title)}</span><span>${opts.index} / ${opts.total}</span></div>`)
    );

    view.appendChild(
      el(`<div class="quiz-prompt">
          <div class="lang-tag">${frontLang(card)} → ${backLang(card)}</div>
          <div class="word">${esc(front(card))}</div>
        </div>`)
    );

    const optWrap = el(`<div class="quiz-options"></div>`);
    const buttons = [];
    options.forEach((o) => {
      const b = el(`<button class="quiz-opt"><span>${esc(back(o))}</span><span class="mark"></span></button>`);
      b.addEventListener("click", () => choose(o, b));
      buttons.push({ card: o, btn: b });
      optWrap.appendChild(b);
    });
    view.appendChild(optWrap);
    app.appendChild(view);

    if (settings.direction === "pt-de") speak(card.pt);

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
      setTimeout(opts.next, ok ? 750 : 1400);
    }

    document.getElementById("exit").addEventListener("click", opts.exit);
  }

  // =================================================================
  //  EINSTELLUNGEN
  // =================================================================
  function renderSettings() {
    clear();
    const view = el(`<div class="fade-in"></div>`);
    view.appendChild(el(`<div class="topbar"><button class="back-btn" id="back">‹ Zurück</button><h1 style="font-size:20px;margin-left:4px">Einstellungen</h1></div>`));

    // Richtung
    const dirGroup = el(`<div class="setting-group">
        <div class="setting-row">
          <div>Lernrichtung<div class="desc">Was steht auf der Vorderseite?</div></div>
          <div class="seg" id="dirSeg">
            <button data-v="pt-de" class="${settings.direction === "pt-de" ? "active" : ""}">PT → DE</button>
            <button data-v="de-pt" class="${settings.direction === "de-pt" ? "active" : ""}">DE → PT</button>
          </div>
        </div>
      </div>`);
    view.appendChild(dirGroup);

    // Audio + Theme
    const miscGroup = el(`<div class="setting-group">
        <div class="setting-row">
          <div>Aussprache ${speechAvailable ? "" : "<div class='desc'>Auf diesem Gerät nicht verfügbar</div>"}
            ${speechAvailable ? "<div class='desc'>Portugiesisch automatisch vorlesen</div>" : ""}</div>
          <div class="switch ${settings.audio ? "on" : ""}" id="audioSw" ${speechAvailable ? "" : 'style="opacity:.4"'}></div>
        </div>
        <div class="setting-row">
          <div>Darstellung</div>
          <div class="seg" id="themeSeg">
            <button data-v="auto" class="${settings.theme === "auto" ? "active" : ""}">Auto</button>
            <button data-v="light" class="${settings.theme === "light" ? "active" : ""}">Hell</button>
            <button data-v="dark" class="${settings.theme === "dark" ? "active" : ""}">Dunkel</button>
          </div>
        </div>
      </div>`);
    view.appendChild(miscGroup);

    const reset = el(`<button class="danger-btn" id="reset">Lernfortschritt zurücksetzen</button>`);
    view.appendChild(reset);

    view.appendChild(
      el(`<div class="install-tip">💡 <b>Als App installieren:</b> In Safari auf das Teilen-Symbol
        tippen und „Zum Home-Bildschirm“ wählen. Dann startet der Trainer wie eine echte App –
        auch offline.</div>`)
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
      if (confirm("Wirklich den gesamten Lernfortschritt löschen? Das kann nicht rückgängig gemacht werden.")) {
        progress = {};
        saveProgress(progress);
        renderHome();
      }
    });
  }

  // ---------- Service Worker ----------
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }

  // iOS Safari: Audio erst nach erster Nutzergeste freischalten
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
