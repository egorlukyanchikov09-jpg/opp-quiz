(() => {
  "use strict";

  let state = {
    name: "",
    group: "",
    selectedModules: [1, 3, 4],
    questions: [],
    current: 0,
    score: 0,
    lives: 3,
    selected: null,
    answered: false,
    cheated: false,
    startTime: null,
    endTime: null,
    answersLog: [],
    timerId: null,
    timeLeft: 55,
    isAdmin: false
  };

  const $ = (id) => document.getElementById(id);
  const startScreen = $("start-screen");
  const quizScreen = $("quiz-screen");
  const resultScreen = $("result-screen");
  const adminScreen = $("admin-screen");
  const cheatOverlay = $("cheat-overlay");

  function normalizeName(s) {
    return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function isAdminName(name) {
    return normalizeName(name) === ADMIN_NAME;
  }

  function markCheat() {
    if (state.cheated) return;
    state.cheated = true;
    state.lives = 0;
    clearInterval(state.timerId);
    cheatOverlay.style.display = "flex";
    setTimeout(() => finishQuiz(true), 2500);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && quizScreen.classList.contains("active") && !state.cheated) markCheat();
  });
  window.addEventListener("blur", () => {
    if (quizScreen.classList.contains("active") && !state.cheated) {
      setTimeout(() => {
        if (!document.hasFocus() && quizScreen.classList.contains("active") && !state.cheated) markCheat();
      }, 400);
    }
  });
  window.addEventListener("beforeunload", (e) => {
    if (quizScreen.classList.contains("active") && !state.cheated) {
      markCheat();
      e.preventDefault();
      e.returnValue = "Тест будет аннулирован!";
      return e.returnValue;
    }
  });
  document.addEventListener("contextmenu", (e) => e.preventDefault());
  document.addEventListener("copy", (e) => e.preventDefault());
  document.addEventListener("cut", (e) => e.preventDefault());
  document.addEventListener("paste", (e) => e.preventDefault());
  document.addEventListener("selectstart", (e) => e.preventDefault());
  document.addEventListener("keydown", (e) => {
    if (
      e.key === "F12" ||
      (e.ctrlKey && e.shiftKey && ["I", "J", "C"].includes(e.key.toUpperCase())) ||
      (e.ctrlKey && ["U", "S", "P"].includes(e.key.toUpperCase()))
    ) {
      e.preventDefault();
      if (quizScreen.classList.contains("active")) markCheat();
    }
  });

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function showScreen(screen) {
    [startScreen, quizScreen, resultScreen, adminScreen].forEach((s) => s.classList.remove("active"));
    screen.classList.add("active");
  }

  function updateHearts() {
    let html = "";
    for (let i = 0; i < 3; i++) {
      html += i < state.lives ? "❤️" : "<span class='heart lost'>🖤</span>";
    }
    $("hearts").innerHTML = html;
  }

  function updateProgress() {
    const pct = state.questions.length ? (state.current / state.questions.length) * 100 : 0;
    $("progress").style.width = pct + "%";
  }

  function updateScore() {
    $("score-display").textContent = state.score + " XP";
  }

  document.querySelectorAll(".module-card").forEach((card) => {
    card.addEventListener("click", () => {
      card.classList.toggle("selected");
    });
  });

  function startTimer() {
    state.timeLeft = 55;
    clearInterval(state.timerId);
    const el = $("timer");
    el.classList.remove("urgent");
    const tick = () => {
      const m = String(Math.floor(state.timeLeft / 60)).padStart(2, "0");
      const s = String(state.timeLeft % 60).padStart(2, "0");
      el.textContent = `${m}:${s}`;
      if (state.timeLeft <= 10) el.classList.add("urgent");
      if (state.timeLeft <= 0) {
        clearInterval(state.timerId);
        if (!state.answered) {
          state.selected = -1;
          checkAnswer(true);
        }
        return;
      }
      state.timeLeft--;
    };
    tick();
    state.timerId = setInterval(tick, 1000);
  }

  function startQuiz() {
    const name = $("student-name").value.trim();
    const group = $("student-group").value.trim();
    if (name.length < 3) {
      alert("Введите полное ФИО");
      return;
    }

    if (isAdminName(name)) {
      state.name = name;
      state.isAdmin = true;
      openAdminPanel();
      return;
    }

    const selected = [];
    document.querySelectorAll(".module-card.selected").forEach((c) => {
      selected.push(+c.dataset.mod);
    });
    if (!selected.length) {
      alert("Выберите хотя бы один модуль");
      return;
    }

    state.name = name;
    state.group = group || "—";
    state.selectedModules = selected;
    state.isAdmin = false;

    let pool = QUESTIONS.filter((q) => selected.includes(q.module));
    state.questions = shuffle(pool).map((q) => {
      const opts = q.options.map((o, i) => ({ text: o, orig: i }));
      const shuffled = shuffle(opts);
      const newCorrect = shuffled.findIndex((o) => o.orig === q.correct);
      return { ...q, options: shuffled.map((o) => o.text), correct: newCorrect };
    });

    state.current = 0;
    state.score = 0;
    state.lives = 3;
    state.selected = null;
    state.answered = false;
    state.cheated = false;
    state.answersLog = [];
    state.startTime = new Date();
    cheatOverlay.style.display = "none";
    showScreen(quizScreen);
    try { document.documentElement.requestFullscreen?.(); } catch (_) {}
    renderQuestion();
  }

  function renderQuestion() {
    if (state.current >= state.questions.length || state.lives <= 0) {
      finishQuiz(false);
      return;
    }
    const q = state.questions[state.current];
    state.selected = null;
    state.answered = false;

    $("mod-badge").textContent = "М" + q.module;
    $("q-type").textContent = `Вопрос ${state.current + 1} из ${state.questions.length} · Модуль ${q.module}`;
    $("q-text").textContent = q.text;

    const optsEl = $("options");
    optsEl.innerHTML = "";
    const card = $("q-card");
    card.style.animation = "none";
    card.offsetHeight;
    card.style.animation = "";

    q.options.forEach((opt, i) => {
      const div = document.createElement("div");
      div.className = "option";
      div.textContent = opt;
      div.dataset.idx = i;
      div.onclick = () => selectOption(i);
      optsEl.appendChild(div);
    });
    $("feedback").className = "feedback";
    $("feedback").style.display = "none";
    $("btn-check").style.display = "none";
    $("btn-check").classList.remove("visible");
    $("btn-next").style.display = "none";
    updateHearts();
    updateProgress();
    updateScore();
    startTimer();
  }

  function selectOption(idx) {
    if (state.answered) return;
    state.selected = idx;
    document.querySelectorAll(".option").forEach((el) => {
      el.classList.toggle("selected", +el.dataset.idx === idx);
    });
    $("btn-check").style.display = "block";
    $("btn-check").classList.add("visible");
  }

  function checkAnswer(timeout = false) {
    if (state.answered) return;
    state.answered = true;
    clearInterval(state.timerId);
    const q = state.questions[state.current];
    const correct = state.selected === q.correct;
    document.querySelectorAll(".option").forEach((el) => {
      el.classList.add("disabled");
      const i = +el.dataset.idx;
      if (i === q.correct) el.classList.add("correct");
      else if (i === state.selected && !correct) el.classList.add("wrong");
    });

    const fb = $("feedback");
    if (correct) {
      const xp = Math.max(5, Math.round(15 * (state.timeLeft / 55)));
      state.score += xp;
      fb.className = "feedback ok";
      fb.textContent = `✅ Верно! +${xp} XP`;
      fb.style.display = "block";
    } else {
      state.lives--;
      updateHearts();
      fb.className = "feedback bad";
      fb.textContent = timeout
        ? `⏱ Время вышло! Правильный ответ: «${q.options[q.correct]}»`
        : `❌ Неверно. Правильный ответ: «${q.options[q.correct]}»`;
      fb.style.display = "block";
    }

    state.answersLog.push({
      module: q.module,
      q: q.text,
      selected: state.selected >= 0 ? q.options[state.selected] : "(время)",
      correct: q.options[q.correct],
      isCorrect: correct,
      timeLeft: state.timeLeft
    });

    $("btn-check").style.display = "none";
    $("btn-next").style.display = "block";
    updateScore();
    if (state.lives <= 0) setTimeout(() => finishQuiz(false), 1200);
  }

  function nextQuestion() {
    state.current++;
    renderQuestion();
  }

  function finishQuiz(fromCheat) {
    clearInterval(state.timerId);
    state.endTime = new Date();
    showScreen(resultScreen);

    const total = state.questions.length || 1;
    const correctCount = state.answersLog.filter((a) => a.isCorrect).length;
    const pct = state.cheated ? 0 : Math.round((correctCount / total) * 100);
    const durationSec = Math.round((state.endTime - state.startTime) / 1000);

    let emoji = "🎉", title = "Отлично!";
    if (state.cheated || fromCheat) { emoji = "🚫"; title = "Списывание"; }
    else if (state.lives <= 0) { emoji = "💔"; title = "Жизни закончились"; }
    else if (pct >= 90) { emoji = "🏆"; title = "Превосходно!"; }
    else if (pct >= 70) { emoji = "👏"; title = "Хорошо!"; }
    else if (pct >= 50) { emoji = "👍"; title = "Неплохо"; }
    else { emoji = "📚"; title = "Нужно повторить"; }

    $("result-emoji").textContent = emoji;
    $("result-title").textContent = title;
    $("result-score").textContent = state.cheated ? "0 / " + total + " (аннулировано)" : `${correctCount} / ${total}`;
    $("xp-fill").style.width = (state.cheated ? 0 : pct) + "%";

    const mins = Math.floor(durationSec / 60);
    const secs = durationSec % 60;
    const mods = state.selectedModules.map((m) => "М" + m).join(", ");
    $("result-details").innerHTML = state.cheated
      ? `Студент: <strong>${state.name}</strong><br>Группа: ${state.group}<br>Статус: <strong style="color:#c00">СПИСЫВАНИЕ</strong>`
      : `Студент: <strong>${state.name}</strong> · ${state.group}<br>
         Модули: ${mods}<br>
         XP: <strong>${state.score}</strong> · Время: ${mins}м ${secs}с<br>
         Правильных: ${correctCount} из ${total} (${pct}%)`;

    $("cheat-banner").style.display = state.cheated ? "block" : "none";
    if (!state.cheated && pct >= 70) launchConfetti();

    saveResult();
  }

  function getHistory() {
    try { return JSON.parse(localStorage.getItem("opp_quiz_history_v2") || "[]"); }
    catch { return []; }
  }

  function saveResult() {
    const total = state.questions.length || 1;
    const correctCount = state.answersLog.filter((a) => a.isCorrect).length;
    const pct = state.cheated ? 0 : Math.round((correctCount / total) * 100);
    const durationSec = Math.round((state.endTime - state.startTime) / 1000);
    const entry = {
      date: state.endTime.toLocaleString("ru-RU"),
      ts: state.endTime.getTime(),
      name: state.name,
      group: state.group,
      modules: state.selectedModules.join(","),
      status: state.cheated ? "СПИСЫВАНИЕ" : "Пройден",
      correct: state.cheated ? 0 : correctCount,
      total,
      pct,
      xp: state.cheated ? 0 : state.score,
      duration: durationSec,
      lives: state.lives,
      answers: state.answersLog
    };
    const history = getHistory();
    history.unshift(entry);
    localStorage.setItem("opp_quiz_history_v2", JSON.stringify(history.slice(0, 500)));
  }

  function buildPersonalExcel() {
    const total = state.questions.length;
    const correctCount = state.answersLog.filter((a) => a.isCorrect).length;
    const pct = state.cheated ? 0 : Math.round((correctCount / total) * 100);
    const durationSec = Math.round((state.endTime - state.startTime) / 1000);
    const wb = XLSX.utils.book_new();

    const summary = [
      ["Тест ОПП · Алабуга"],
      ["Дата", state.endTime.toLocaleString("ru-RU")],
      ["ФИО", state.name],
      ["Группа", state.group],
      ["Модули", state.selectedModules.join(", ")],
      ["Статус", state.cheated ? "СПИСЫВАНИЕ" : "Пройден"],
      ["Правильных", state.cheated ? 0 : correctCount],
      ["Всего", total],
      ["%", pct + "%"],
      ["XP", state.cheated ? 0 : state.score],
      ["Время (сек)", durationSec]
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(summary);
    ws1["!cols"] = [{ wch: 18 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, ws1, "Итог");

    const details = [["№", "Модуль", "Вопрос", "Ответ", "Правильный", "Верно?"]];
    state.answersLog.forEach((a, i) => {
      details.push([i + 1, a.module, a.q, a.selected, a.correct, a.isCorrect ? "Да" : "Нет"]);
    });
    const ws2 = XLSX.utils.aoa_to_sheet(details);
    ws2["!cols"] = [{ wch: 4 }, { wch: 8 }, { wch: 50 }, { wch: 30 }, { wch: 30 }, { wch: 8 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Ответы");
    return wb;
  }

  function downloadPersonal() {
    const wb = buildPersonalExcel();
    const safe = state.name.replace(/[\\/:*?"<>|]/g, "_").slice(0, 35);
    XLSX.writeFile(wb, `ОПП_${safe}_${state.cheated ? "СПИС" : "OK"}_${Date.now()}.xlsx`);
  }

  function buildMasterExcel() {
    const history = getHistory();
    const wb = XLSX.utils.book_new();
    const rows = [["Дата", "ФИО", "Группа", "Модули", "Статус", "Правильных", "Всего", "%", "XP", "Время (с)", "Жизни"]];
    history.forEach((h) => {
      rows.push([h.date, h.name, h.group, h.modules, h.status, h.correct, h.total, h.pct, h.xp, h.duration, h.lives]);
    });
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 18 }, { wch: 28 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 8 }, { wch: 6 }, { wch: 6 }, { wch: 10 }, { wch: 8 }];
    XLSX.utils.book_append_sheet(wb, ws, "Все результаты");
    return wb;
  }

  function downloadMaster() {
    const wb = buildMasterExcel();
    XLSX.writeFile(wb, `ОПП_все_результаты_${Date.now()}.xlsx`);
  }

  function openAdminPanel() {
    showScreen(adminScreen);
    const history = getHistory();
    const total = history.length;
    const ok = history.filter((h) => h.status === "Пройден").length;
    const cheat = history.filter((h) => h.status === "СПИСЫВАНИЕ").length;
    const avg = total ? Math.round(history.reduce((s, h) => s + (h.pct || 0), 0) / total) : 0;

    $("stats-grid").innerHTML = `
      <div class="stat-card"><div class="num">${total}</div><div class="lbl">Всего попыток</div></div>
      <div class="stat-card"><div class="num">${ok}</div><div class="lbl">Успешных</div></div>
      <div class="stat-card"><div class="num">${cheat}</div><div class="lbl">Списываний</div></div>
      <div class="stat-card"><div class="num">${avg}%</div><div class="lbl">Средний %</div></div>
    `;

    const tbody = $("results-tbody");
    tbody.innerHTML = "";
    if (!history.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#8AA0B5;padding:1.5rem;">Пока нет результатов на этом устройстве</td></tr>`;
      return;
    }
    history.slice(0, 100).forEach((h) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${h.date}</td>
        <td>${h.name}</td>
        <td>${h.group}</td>
        <td>${h.modules}</td>
        <td>${h.pct}%</td>
        <td>${h.xp}</td>
        <td>${h.status === "СПИСЫВАНИЕ" ? '<span class="badge-cheat">СПИС</span>' : '<span class="badge-ok">OK</span>'}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function launchConfetti() {
    const canvas = $("confetti");
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const pieces = [];
    const colors = ["#0055A5", "#4DA3FF", "#003D7A", "#00C853", "#FF9100"];
    for (let i = 0; i < 140; i++) {
      pieces.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        w: 7 + Math.random() * 6,
        h: 5 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        speed: 2 + Math.random() * 4,
        rot: Math.random() * 360,
        rotSpeed: -5 + Math.random() * 10
      });
    }
    let frames = 0;
    function frame() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pieces.forEach((p) => {
        p.y += p.speed;
        p.rot += p.rotSpeed;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      frames++;
      if (frames < 200) requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    frame();
  }

  $("btn-start").onclick = startQuiz;
  $("btn-check").onclick = () => checkAnswer(false);
  $("btn-next").onclick = nextQuestion;
  $("btn-download-personal").onclick = downloadPersonal;
  $("btn-export-all").onclick = downloadMaster;
  $("btn-restart").onclick = () => {
    try { document.exitFullscreen?.(); } catch (_) {}
    showScreen(startScreen);
    $("student-name").value = state.name;
    $("student-group").value = state.group;
  };
  $("btn-admin-back").onclick = () => showScreen(startScreen);

  $("student-name").addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("student-group").focus();
  });
  $("student-group").addEventListener("keydown", (e) => {
    if (e.key === "Enter") startQuiz();
  });
})();
