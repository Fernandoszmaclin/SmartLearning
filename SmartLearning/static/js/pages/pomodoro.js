/* SmartLearning — Timer Pomodoro.
   Ciclos de foco/pausa, registro de sessões e estatísticas do dia. */
(function () {
  "use strict";

  const getCookie = (name) => {
    const m = document.cookie.match(`(^|;)\\s*${name}\\s*=\\s*([^;]+)`);
    return m ? m.pop() : "";
  };
  const CSRF = getCookie("csrftoken");

  const root = document.getElementById("pomodoro");
  if (!root) return;
  
  const LOG_URL = root.dataset.logUrl || "/pomodoro/api/pomodoro/log/";
  const STATS_URL = root.dataset.statsUrl || "/pomodoro/api/pomodoro/stats/";
  // Lido a cada log: a navegação SPA do workspace atualiza este data-attr.
  const currentPageId = () => (root.dataset.pageId ? Number(root.dataset.pageId) : null);

  const timeEl = document.getElementById("pomo-time");
  const modeEl = document.getElementById("pomo-mode");
  const toggleBtn = document.getElementById("pomo-toggle");
  const resetBtn = document.getElementById("pomo-reset");
  const skipBtn = document.getElementById("pomo-skip");
  const taskEl = document.getElementById("pomo-task");
  const collapseBtn = document.getElementById("pomo-collapse");
  const setWork = document.getElementById("set-work");
  const setShort = document.getElementById("set-short");
  const setLong = document.getElementById("set-long");
  const statSessions = document.getElementById("stat-sessions");
  const statMinutes = document.getElementById("stat-minutes");

  const MODE = { WORK: "work", SHORT: "short_break", LONG: "long_break" };
  const LABELS = { work: "Foco", short_break: "Pausa curta", long_break: "Pausa longa" };
  const SETTINGS_KEY = "sl-pomodoro-settings";

  const clampInt = (v, min, max, fallback) => {
    let n = parseInt(v, 10);
    if (isNaN(n)) n = fallback;
    return Math.min(max, Math.max(min, n));
  };

  const loadSettings = () => {
    try {
      const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
      if (s.work) setWork.value = s.work;
      if (s.short) setShort.value = s.short;
      if (s.long) setLong.value = s.long;
    } catch (e) { /* ignora */ }
  };

  const saveSettings = () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      work: clampInt(setWork.value, 1, 120, 25),
      short: clampInt(setShort.value, 1, 60, 5),
      long: clampInt(setLong.value, 1, 60, 15),
    }));
  };

  const minutesFor = (m) => {
    if (m === MODE.WORK) return clampInt(setWork.value, 1, 120, 25);
    if (m === MODE.SHORT) return clampInt(setShort.value, 1, 60, 5);
    return clampInt(setLong.value, 1, 60, 15);
  };

  loadSettings();

  let mode = MODE.WORK;
  let remaining = minutesFor(mode) * 60;
  let running = false;
  let timer = null;
  let workStreak = 0;
  let audioCtx = null;

  const render = () => {
    const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
    const ss = String(remaining % 60).padStart(2, "0");
    timeEl.textContent = `${mm}:${ss}`;
    modeEl.textContent = LABELS[mode];
    toggleBtn.textContent = running ? "Pausar" : "Começar";
    root.classList.toggle("is-break", mode !== MODE.WORK);
    document.title = `${running ? timeEl.textContent + " · " : ""}SmartLearning`;
  };

  const tick = () => {
    remaining -= 1;
    if (remaining <= 0) {
      completeInterval();
      return;
    }
    render();
  };

  const start = () => {
    if (running) return;
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
    }
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
    running = true;
    timer = setInterval(tick, 1000);
    render();
  };

  const pause = () => {
    running = false;
    clearInterval(timer);
    render();
  };

  const toggle = () => (running ? pause() : start());

  const reset = () => {
    pause();
    remaining = minutesFor(mode) * 60;
    render();
  };

  const nextMode = () => {
    if (mode === MODE.WORK) {
      workStreak += 1;
      return (workStreak % 4 === 0) ? MODE.LONG : MODE.SHORT;
    }
    return MODE.WORK;
  };

  const switchMode = (newMode, autostart) => {
    mode = newMode;
    remaining = minutesFor(mode) * 60;
    pause();
    render();
    if (autostart) start();
  };

  const skip = () => switchMode(nextMode(), false);

  const logSession = async (minutes) => {
    try {
      const res = await fetch(LOG_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": CSRF },
        body: JSON.stringify({
          minutes,
          mode: MODE.WORK,
          label: taskEl.value.trim(),
          page: currentPageId(),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (statSessions) statSessions.textContent = data.sessions_today;
        if (statMinutes) statMinutes.textContent = data.minutes_today;
      }
    } catch (e) { console.error(e); }
  };

  const notify = (finishedMode) => {
    const msg = finishedMode === MODE.WORK
      ? "Foco concluído — hora da pausa!"
      : "Pausa acabou — de volta ao foco.";
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("SmartLearning", { body: msg });
    }
  };

  const beep = () => {
    if (!audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = "sine";
      osc.frequency.value = 660;
      gain.gain.setValueAtTime(0.001, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.3, audioCtx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.4);
    } catch (e) { /* ignora */ }
  };

  const completeInterval = async () => {
    pause();
    const finished = mode;
    notify(finished);
    beep();
    if (finished === MODE.WORK) {
      await logSession(minutesFor(MODE.WORK));
    }
    switchMode(nextMode(), true); // já inicia o próximo intervalo
  };

  // ---- liga os controles ----
  toggleBtn.addEventListener("click", toggle);
  resetBtn.addEventListener("click", reset);
  skipBtn.addEventListener("click", skip);
  collapseBtn.addEventListener("click", () => root.classList.toggle("collapsed"));

  [setWork, setShort, setLong].forEach((inp) => {
    inp.addEventListener("change", () => {
      saveSettings();
      if (!running) reset();
    });
  });

  const refreshStats = async () => {
    try {
      const res = await fetch(STATS_URL);
      if (!res.ok) return;
      const d = await res.json();
      if (statSessions) statSessions.textContent = d.sessions_today;
      if (statMinutes) statMinutes.textContent = d.minutes_today;
    } catch (e) { /* ignora */ }
  };

  render();
  refreshStats();
})();
