(() => {
  "use strict";

  // ========== State ==========
  let state = {
    name: "",
    group: "",
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
    timeLeft: 60,
    totalTime: 0
  };

  // ========== DOM ==========
  const $ = (id) => document.getElementById(id);
  const startScreen = $("start-screen");
  const quizScreen = $("quiz-screen");
  const resultScreen = $("result-screen");
  const cheatOverlay = $("cheat-overlay");

  // ========== Anti-cheat ==========
  function markCheat(reason) {
    if (state.cheated) return;
    state.cheated = true;
    state.lives = 0;
    clearInterval(state.timerId);
    cheatOverlay.style.display = "flex";
    // Immediately finish as failed
    setTimeout(() => {
      finishQuiz(true);
    }, 2500);
  }

  // Tab / page visibility
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && quizScreen.classList.contains("active") && !state.cheated) {
      markCheat("visibilitychange");
    }
  });

  // Blur (window lose focus)
  window.addEventListener("blur", () => {
    if (quizScreen.classList.contains("active") && !state.cheated) {
      // small delay to avoid false positives on some systems
      setTimeout(() => {
        if (!document.hasFocus() && quizScreen.classList.contains("active") && !state.cheated) {
          markCheat("blur");
        }
      }, 400);
    }
  });

  // Before unload
  window.addEventListener("beforeunload", (e) => {
    if (quizScreen.classList.contains("active") && !state.cheated) {
      markCheat("beforeunload");
      e.preventDefault();
      e.returnValue = "Тест будет аннулирован как списывание!";
      return e.returnValue;
    }
  });

  // Disable context menu, copy, cut, paste, select
  document.addEventListener("contextmenu", (e) => e.preventDefault());
  document.addEventListener("copy", (e) => e.preventDefault());
  document.addEventListener("cut", (e) => e.preventDefault());
  document.addEventListener("paste", (e) => e.preventDefault());
  document.addEventListener("selectstart", (e) => e.preventDefault());

  // Block common cheat keys
  document.addEventListener("keydown", (e) => {
    if (
      e.key === "F12" ||
      (e.ctrlKey && e.shiftKey && ["I", "J", "C"].includes(e.key.toUpperCase())) ||
      (e.ctrlKey && ["U", "S", "P"].includes(e.key.toUpperCase())) ||
      (e.metaKey && e.altKey && e.key.toUpperCase() === "I")
    ) {
      e.preventDefault();
      if (quizScreen.classList.contains("active")) markCheat("devtools");
    }
  });

  // ========== Helpers ==========
  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function showScreen(screen) {
    [startScreen, quizScreen, resultScreen].forEach((s) => s.classList.remove("active"));
    screen.classList.add("active");
  }

  function updateHearts() {
    const hearts = $("hearts");
    let html = "";
    for (let i = 0; i < 3; i++) {
      html += i < state.lives ? "❤️" : "<span class='heart lost'>🖤</span>";
    }
    hearts.innerHTML = html;
  }

  function updateProgress() {
    const pct = (state.current / state.questions.length) * 100;
    $("progress").style.width = pct + "%";
  }

  function updateScore() {
    $("score-display").textContent = state.score + " XP";
  }

  // ========== Timer ==========
  function startTimer() {
    state.timeLeft = 55; // seconds per question
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
        // auto wrong
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

  // ========== Quiz logic ==========
  function startQuiz() {
    const name = $("student-name").value.trim();
    const group = $("student-group").value.trim();
    if (name.length < 3) {
      alert("Введите полное ФИО (минимум 3 символа)");
      return;
    }
    state.name = name;
    state.group = group || "—";
    state.questions = shuffle(QUESTIONS).map((q) => {
      // also shuffle options but keep correct index
      const opts = q.options.map((o, i) => ({ text: o, orig: i }));
      const shuffled = shuffle(opts);
      const newCorrect = shuffled.findIndex((o) => o.orig === q.correct);
      return {
        ...q,
        options: shuffled.map((o) => o.text),
        correct: newCorrect
      };
    });
    state.current = 0;
    state.score = 0;
    state.lives = 3;
    state.selected = null;
    state.answered = false;
    state.cheated = false;
    state.answersLog = [];
    state.startTime = new Date();
    state.totalTime = 0;
    cheatOverlay.style.display = "none";
    showScreen(quizScreen);
    // try request fullscreen
    try {
      document.documentElement.requestFullscreen?.();
    } catch (_) {}
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
    $("q-type").textContent = `Вопрос ${state.current + 1} из ${state.questions.length} • ${q.type}`;
    $("q-text").textContent = q.text;
    const optsEl = $("options");
    optsEl.innerHTML = "";
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
    const opts = document.querySelectorAll(".option");
    opts.forEach((el) => {
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
      q: q.text,
      selected: state.selected >= 0 ? q.options[state.selected] : "(время)",
      correct: q.options[q.correct],
      isCorrect: correct,
      timeLeft: state.timeLeft
    });

    $("btn-check").style.display = "none";
    $("btn-next").style.display = "block";
    updateScore();

    if (state.lives <= 0) {
      setTimeout(() => finishQuiz(false), 1200);
    }
  }

  function nextQuestion() {
    state.current++;
    renderQuestion();
  }

  function finishQuiz(fromCheat) {
    clearInterval(state.timerId);
    state.endTime = new Date();
    const durationSec = Math.round((state.endTime - state.startTime) / 1000);
    showScreen(resultScreen);

    const total = state.questions.length;
    const correctCount = state.answersLog.filter((a) => a.isCorrect).length;
    const pct = Math.round((correctCount / total) * 100);

    let emoji = "🎉";
    let title = "Отлично!";
    if (state.cheated || fromCheat) {
      emoji = "🚫";
      title = "Списывание";
    } else if (state.lives <= 0) {
      emoji = "💔";
      title = "Жизни закончились";
    } else if (pct >= 90) {
      emoji = "🏆";
      title = "Превосходно!";
    } else if (pct >= 70) {
      emoji = "👏";
      title = "Хорошо!";
    } else if (pct >= 50) {
      emoji = "👍";
      title = "Неплохо";
    } else {
      emoji = "📚";
      title = "Нужно повторить";
    }

    $("result-emoji").textContent = emoji;
    $("result-title").textContent = title;
    $("result-score").textContent = state.cheated
      ? "0 / " + total + " (аннулировано)"
      : `${correctCount} / ${total}`;
    $("xp-fill").style.width = (state.cheated ? 0 : pct) + "%";

    const mins = Math.floor(durationSec / 60);
    const secs = durationSec % 60;
    $("result-details").innerHTML = state.cheated
      ? `Студент: <strong>${state.name}</strong><br>Группа: ${state.group}<br>Статус: <strong style="color:#c00">СПИСЫВАНИЕ</strong>`
      : `Студент: <strong>${state.name}</strong><br>Группа: ${state.group}<br>
         XP: <strong>${state.score}</strong> • Время: ${mins}м ${secs}с<br>
         Правильных: ${correctCount} из ${total} (${pct}%)`;

    if (state.cheated) {
      $("cheat-banner").style.display = "block";
    } else {
      $("cheat-banner").style.display = "none";
      if (pct >= 70) launchConfetti();
    }

    // Auto-save attempt to localStorage history
    saveToLocalHistory();
  }

  // ========== Excel export ==========
  function buildExcel() {
    const total = state.questions.length;
    const correctCount = state.answersLog.filter((a) => a.isCorrect).length;
    const pct = state.cheated ? 0 : Math.round((correctCount / total) * 100);
    const durationSec = Math.round((state.endTime - state.startTime) / 1000);

    const wb = XLSX.utils.book_new();

    // Summary sheet
    const summary = [
      ["Тест ОПП — Сокращённые модули СК"],
      ["Дата и время", state.endTime.toLocaleString("ru-RU")],
      ["ФИО", state.name],
      ["Группа", state.group],
      ["Статус", state.cheated ? "СПИСЫВАНИЕ" : "Пройден"],
      ["Правильных ответов", state.cheated ? 0 : correctCount],
      ["Всего вопросов", total],
      ["Процент", pct + "%"],
      ["Набрано XP", state.cheated ? 0 : state.score],
      ["Осталось жизней", state.lives],
      ["Время прохождения (сек)", durationSec],
      [],
      ["Инструкция: загрузите этот файл в папку Синолоджи Драйв → результаты/ОПП_тесты"]
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(summary);
    ws1["!cols"] = [{ wch: 28 }, { wch: 45 }];
    XLSX.utils.book_append_sheet(wb, ws1, "Итог");

    // Detailed answers
    const details = [
      ["№", "Вопрос", "Ответ студента", "Правильный ответ", "Верно?", "Осталось сек"]
    ];
    state.answersLog.forEach((a, i) => {
      details.push([
        i + 1,
        a.q,
        a.selected,
        a.correct,
        a.isCorrect ? "Да" : "Нет",
        a.timeLeft
      ]);
    });
    const ws2 = XLSX.utils.aoa_to_sheet(details);
    ws2["!cols"] = [{ wch: 4 }, { wch: 60 }, { wch: 35 }, { wch: 35 }, { wch: 8 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Ответы");

    // History sheet (all local attempts)
    const history = JSON.parse(localStorage.getItem("opp_quiz_history") || "[]");
    const histRows = [
      ["Дата", "ФИО", "Группа", "Статус", "Правильных", "Всего", "%", "XP", "Время (с)"]
    ];
    history.forEach((h) => {
      histRows.push([
        h.date,
        h.name,
        h.group,
        h.status,
        h.correct,
        h.total,
        h.pct,
        h.xp,
        h.duration
      ]);
    });
    const ws3 = XLSX.utils.aoa_to_sheet(histRows);
    ws3["!cols"] = [{ wch: 20 }, { wch: 30 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 8 }, { wch: 6 }, { wch: 8 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws3, "История");

    return wb;
  }

  function downloadExcel() {
    const wb = buildExcel();
    const safeName = state.name.replace(/[\\/:*?"<>|]/g, "_").slice(0, 40);
    const status = state.cheated ? "СПИСЫВАНИЕ" : "OK";
    const fname = `ОПП_тест_${safeName}_${status}_${Date.now()}.xlsx`;
    XLSX.writeFile(wb, fname);
  }

  function saveToLocalHistory() {
    const total = state.questions.length;
    const correctCount = state.answersLog.filter((a) => a.isCorrect).length;
    const pct = state.cheated ? 0 : Math.round((correctCount / total) * 100);
    const durationSec = Math.round((state.endTime - state.startTime) / 1000);
    const entry = {
      date: state.endTime.toLocaleString("ru-RU"),
      name: state.name,
      group: state.group,
      status: state.cheated ? "СПИСЫВАНИЕ" : "Пройден",
      correct: state.cheated ? 0 : correctCount,
      total,
      pct,
      xp: state.cheated ? 0 : state.score,
      duration: durationSec,
      lives: state.lives
    };
    const history = JSON.parse(localStorage.getItem("opp_quiz_history") || "[]");
    history.unshift(entry);
    localStorage.setItem("opp_quiz_history", JSON.stringify(history.slice(0, 200)));

    // Отправка на локальный сервер (если запущен) → попадёт в Excel и папку results
    try {
      fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry)
      }).catch(() => {});
    } catch (_) {}
  }

  // ========== Confetti ==========
  function launchConfetti() {
    const canvas = $("confetti");
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const pieces = [];
    const colors = ["#58cc02", "#1cb0f6", "#ff9600", "#ce82ff", "#ff4b4b"];
    for (let i = 0; i < 120; i++) {
      pieces.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        w: 8 + Math.random() * 6,
        h: 6 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        speed: 2 + Math.random() * 4,
        rot: Math.random() * 360,
        rotSpeed: -4 + Math.random() * 8
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
      if (frames < 180) requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    frame();
  }

  // ========== Events ==========
  $("btn-start").onclick = startQuiz;
  $("btn-check").onclick = () => checkAnswer(false);
  $("btn-next").onclick = nextQuestion;
  $("btn-download").onclick = downloadExcel;
  $("btn-restart").onclick = () => {
    try {
      document.exitFullscreen?.();
    } catch (_) {}
    showScreen(startScreen);
    $("student-name").value = state.name;
    $("student-group").value = state.group;
  };

  // Enter key on start
  $("student-name").addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("student-group").focus();
  });
  $("student-group").addEventListener("keydown", (e) => {
    if (e.key === "Enter") startQuiz();
  });
})();
