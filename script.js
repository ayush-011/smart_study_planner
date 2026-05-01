const STORAGE_KEYS = {
  tasks: "sspft_tasks",
  dailyStats: "sspft_daily_stats",
  timerState: "sspft_timer_state",
  timerConfig: "sspft_timer_config",
  theme: "sspft_theme",
  goal: "sspft_goal_minutes",
  sessionHistory: "sspft_session_history",
};
const TIMER_RING_RADIUS = 52;
const TIMER_RING_CIRCUMFERENCE = 2 * Math.PI * TIMER_RING_RADIUS;

const QUOTES = [
  "The expert in anything was once a beginner.",
  "Discipline beats motivation when motivation fades.",
  "Your focus creates your future.",
  "Done is better than perfect.",
  "A little progress every day adds up to big results.",
  "Consistency is your superpower.",
];

const state = {
  tasks: [],
  dailyStats: {},
  timerConfig: { focusMinutes: 25, breakMinutes: 5 },
  timer: { mode: "focus", remainingSeconds: 25 * 60, isRunning: false, intervalId: null },
  chart: null,
  dailyGoalMinutes: 240,
  sessionHistory: [],
  taskSearch: "",
};

const elements = {
  taskForm: document.getElementById("taskForm"),
  taskId: document.getElementById("taskId"),
  titleInput: document.getElementById("titleInput"),
  subjectInput: document.getElementById("subjectInput"),
  durationInput: document.getElementById("durationInput"),
  taskPriorityInput: document.getElementById("taskPriorityInput"),
  taskSubmitBtn: document.getElementById("taskSubmitBtn"),
  taskCancelBtn: document.getElementById("taskCancelBtn"),
  taskList: document.getElementById("taskList"),
  taskCountBadge: document.getElementById("taskCountBadge"),
  taskSearchInput: document.getElementById("taskSearchInput"),
  quoteText: document.getElementById("quoteText"),
  newQuoteBtn: document.getElementById("newQuoteBtn"),
  themeToggleBtn: document.getElementById("themeToggleBtn"),
  themeToggleText: document.getElementById("themeToggleText"),
  themeToggleIcon: document.getElementById("themeToggleIcon"),
  statStudyTime: document.getElementById("statStudyTime"),
  statTasksCompleted: document.getElementById("statTasksCompleted"),
  statFocusSessions: document.getElementById("statFocusSessions"),
  statStreak: document.getElementById("statStreak"),
  timerDisplay: document.getElementById("timerDisplay"),
  timerModeBadge: document.getElementById("timerModeBadge"),
  timerHint: document.getElementById("timerHint"),
  timerProgressCircle: document.getElementById("timerProgressCircle"),
  startTimerBtn: document.getElementById("startTimerBtn"),
  pauseTimerBtn: document.getElementById("pauseTimerBtn"),
  resetTimerBtn: document.getElementById("resetTimerBtn"),
  focusDurationInput: document.getElementById("focusDurationInput"),
  breakDurationInput: document.getElementById("breakDurationInput"),
  applyTimerSettingsBtn: document.getElementById("applyTimerSettingsBtn"),
  analyticsChart: document.getElementById("analyticsChart"),
  productivityScore: document.getElementById("productivityScore"),
  completionRate: document.getElementById("completionRate"),
  dailyGoalInput: document.getElementById("dailyGoalInput"),
  saveGoalBtn: document.getElementById("saveGoalBtn"),
  goalProgressText: document.getElementById("goalProgressText"),
  goalProgressFill: document.getElementById("goalProgressFill"),
  streakCalendar: document.getElementById("streakCalendar"),
  streakDaysLabel: document.getElementById("streakDaysLabel"),
  sessionHistoryList: document.getElementById("sessionHistoryList"),
};

function safeParseJSON(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
}

function getTodayKey(date = new Date()) {
  return date.toISOString().split("T")[0];
}

function ensureTodayStats() {
  const key = getTodayKey();
  if (!state.dailyStats[key]) {
    state.dailyStats[key] = { studyMinutes: 0, tasksCompleted: 0, focusSessions: 0 };
  }
}

function formatMinutes(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

function formatTimer(seconds) {
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function getModeSeconds(mode) {
  return mode === "focus" ? state.timerConfig.focusMinutes * 60 : state.timerConfig.breakMinutes * 60;
}

function saveState() {
  localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(state.tasks));
  localStorage.setItem(STORAGE_KEYS.dailyStats, JSON.stringify(state.dailyStats));
  localStorage.setItem(STORAGE_KEYS.timerConfig, JSON.stringify(state.timerConfig));
  localStorage.setItem(STORAGE_KEYS.goal, String(state.dailyGoalMinutes));
  localStorage.setItem(STORAGE_KEYS.sessionHistory, JSON.stringify(state.sessionHistory.slice(0, 20)));
  localStorage.setItem(
    STORAGE_KEYS.timerState,
    JSON.stringify({ mode: state.timer.mode, remainingSeconds: state.timer.remainingSeconds, isRunning: false })
  );
}

function loadState() {
  state.tasks = safeParseJSON(localStorage.getItem(STORAGE_KEYS.tasks), []);
  state.dailyStats = safeParseJSON(localStorage.getItem(STORAGE_KEYS.dailyStats), {});
  const savedTimerConfig = safeParseJSON(localStorage.getItem(STORAGE_KEYS.timerConfig), null);
  if (savedTimerConfig) {
    state.timerConfig.focusMinutes = Math.min(180, Math.max(1, Number(savedTimerConfig.focusMinutes) || 25));
    state.timerConfig.breakMinutes = Math.min(60, Math.max(1, Number(savedTimerConfig.breakMinutes) || 5));
  }
  state.dailyGoalMinutes = Number(localStorage.getItem(STORAGE_KEYS.goal)) || 240;
  state.sessionHistory = safeParseJSON(localStorage.getItem(STORAGE_KEYS.sessionHistory), []);

  const timer = safeParseJSON(localStorage.getItem(STORAGE_KEYS.timerState), null);
  if (timer && ["focus", "break"].includes(timer.mode)) {
    state.timer.mode = timer.mode;
    state.timer.remainingSeconds = Math.max(0, timer.remainingSeconds || 0);
  } else {
    state.timer.remainingSeconds = getModeSeconds("focus");
  }
  ensureTodayStats();
}

function calculateStreak() {
  let streak = 0;
  const date = new Date();
  while (true) {
    const key = getTodayKey(date);
    const day = state.dailyStats[key];
    if (!day || day.studyMinutes <= 0) break;
    streak += 1;
    date.setDate(date.getDate() - 1);
  }
  return streak;
}

function updateTimerProgress() {
  const total = getModeSeconds(state.timer.mode);
  const progress = (total - state.timer.remainingSeconds) / total;
  const offset = TIMER_RING_CIRCUMFERENCE * (1 - progress);
  elements.timerProgressCircle.style.strokeDasharray = String(TIMER_RING_CIRCUMFERENCE);
  elements.timerProgressCircle.style.strokeDashoffset = String(offset);
}

function updateTimerUI() {
  elements.timerDisplay.textContent = formatTimer(state.timer.remainingSeconds);
  elements.timerModeBadge.textContent = state.timer.mode === "focus" ? "Focus" : "Break";
  elements.timerHint.textContent =
    state.timer.mode === "focus" ? "Deep work cycle running" : "Recovery mode, breathe and reset";
  updateTimerProgress();
}

function updateGoalUI(todayMinutes) {
  const progressPercent = Math.min(100, Math.round((todayMinutes / state.dailyGoalMinutes) * 100));
  elements.goalProgressFill.style.width = `${progressPercent}%`;
  elements.goalProgressText.textContent = `Goal Progress: ${progressPercent}% (${todayMinutes}/${state.dailyGoalMinutes} min)`;
}

function updateAdvancedInsights() {
  const total = state.tasks.length;
  const completed = state.tasks.filter((task) => task.completed).length;
  const rate = total ? Math.round((completed / total) * 100) : 0;
  const today = state.dailyStats[getTodayKey()];
  const score = Math.min(100, Math.round(today.focusSessions * 18 + rate * 0.45 + today.studyMinutes * 0.12));

  elements.productivityScore.textContent = String(score);
  elements.completionRate.textContent = `${rate}%`;
}

function updateStatsUI() {
  ensureTodayStats();
  const today = state.dailyStats[getTodayKey()];
  const streak = calculateStreak();
  elements.statStudyTime.textContent = formatMinutes(today.studyMinutes);
  elements.statTasksCompleted.textContent = String(today.tasksCompleted);
  elements.statFocusSessions.textContent = String(today.focusSessions);
  elements.statStreak.textContent = `${streak} days`;
  elements.streakDaysLabel.textContent = `${streak} days`;
  updateGoalUI(today.studyMinutes);
  updateAdvancedInsights();
}

function resetTaskForm() {
  elements.taskForm.reset();
  elements.taskPriorityInput.value = "medium";
  elements.taskId.value = "";
  elements.taskSubmitBtn.textContent = "Add Task";
  elements.taskCancelBtn.classList.add("hidden");
}

function fillTaskForm(task) {
  elements.taskId.value = task.id;
  elements.titleInput.value = task.title;
  elements.subjectInput.value = task.subject;
  elements.durationInput.value = task.duration;
  elements.taskPriorityInput.value = task.priority || "medium";
  elements.taskSubmitBtn.textContent = "Save Changes";
  elements.taskCancelBtn.classList.remove("hidden");
}

function getFilteredTasks() {
  if (!state.taskSearch) return state.tasks;
  const q = state.taskSearch.toLowerCase();
  return state.tasks.filter((task) => `${task.title} ${task.subject}`.toLowerCase().includes(q));
}

function updateTaskCountBadge() {
  const done = state.tasks.filter((task) => task.completed).length;
  elements.taskCountBadge.textContent = `${done}/${state.tasks.length} done`;
}

function renderTasks() {
  const tasks = getFilteredTasks();
  elements.taskList.innerHTML = "";
  if (!tasks.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = state.taskSearch ? "No matching tasks found." : "No tasks yet. Add your first task.";
    elements.taskList.appendChild(empty);
    updateTaskCountBadge();
    return;
  }

  tasks.forEach((task) => {
    const item = document.createElement("article");
    item.className = `task-item ${task.completed ? "completed" : ""}`;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = task.completed;
    checkbox.addEventListener("change", () => toggleTaskCompletion(task.id));

    const content = document.createElement("div");
    const priorityLabel = task.priority || "medium";
    content.innerHTML = `
      <p class="task-title">${task.title}</p>
      <p class="task-meta">${task.subject} • ${task.duration} min • ${task.completed ? "Completed" : "Pending"}
        <span class="task-priority ${priorityLabel}">${priorityLabel}</span>
      </p>
    `;

    const actions = document.createElement("div");
    actions.className = "task-actions";
    const editBtn = document.createElement("button");
    editBtn.className = "btn btn-small btn-secondary";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => fillTaskForm(task));
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn btn-small btn-danger";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", () => removeTask(task.id));
    actions.append(editBtn, deleteBtn);

    item.append(checkbox, content, actions);
    elements.taskList.appendChild(item);
  });
  updateTaskCountBadge();
}

function addTask(payload) {
  state.tasks.unshift({ id: crypto.randomUUID(), ...payload, completed: false });
  saveState();
  renderTasks();
}

function editTask(id, payload) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return;
  Object.assign(task, payload);
  saveState();
  renderTasks();
}

function removeTask(id) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return;
  if (task.completed) {
    ensureTodayStats();
    const today = state.dailyStats[getTodayKey()];
    today.tasksCompleted = Math.max(0, today.tasksCompleted - 1);
    today.studyMinutes = Math.max(0, today.studyMinutes - task.duration);
  }
  state.tasks = state.tasks.filter((item) => item.id !== id);
  saveState();
  renderTasks();
  updateStatsUI();
  renderChart();
  renderStreakCalendar();
}

function toggleTaskCompletion(id) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return;
  ensureTodayStats();
  const today = state.dailyStats[getTodayKey()];

  if (task.completed) {
    task.completed = false;
    today.tasksCompleted = Math.max(0, today.tasksCompleted - 1);
    today.studyMinutes = Math.max(0, today.studyMinutes - task.duration);
  } else {
    task.completed = true;
    today.tasksCompleted += 1;
    today.studyMinutes += task.duration;
  }
  saveState();
  renderTasks();
  updateStatsUI();
  renderChart();
  renderStreakCalendar();
}

function handleTaskSubmit(event) {
  event.preventDefault();
  const payload = {
    title: elements.titleInput.value.trim(),
    subject: elements.subjectInput.value.trim(),
    duration: Number(elements.durationInput.value),
    priority: elements.taskPriorityInput.value,
  };
  if (!payload.title || !payload.subject || payload.duration < 1) return;
  const id = elements.taskId.value;
  if (id) editTask(id, payload);
  else addTask(payload);
  resetTaskForm();
  updateStatsUI();
}

function playNotificationSound() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "triangle";
  oscillator.frequency.value = 880;
  gain.gain.value = 0.0001;
  gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start();
  oscillator.stop(ctx.currentTime + 0.35);
}

function logSession(type) {
  const when = new Date().toLocaleString();
  state.sessionHistory.unshift({ type, when, duration: type === "Focus" ? 25 : 5 });
  state.sessionHistory = state.sessionHistory.slice(0, 20);
}

function renderSessionHistory() {
  elements.sessionHistoryList.innerHTML = "";
  if (!state.sessionHistory.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No sessions yet. Start your first Pomodoro.";
    elements.sessionHistoryList.appendChild(empty);
    return;
  }
  state.sessionHistory.forEach((session) => {
    const item = document.createElement("div");
    item.className = "history-item";
    item.innerHTML = `<span>${session.type} session (${session.duration}m)</span><span>${session.when}</span>`;
    elements.sessionHistoryList.appendChild(item);
  });
}

function switchTimerMode(mode) {
  state.timer.mode = mode;
  state.timer.remainingSeconds = getModeSeconds(mode);
  updateTimerUI();
}

function applyPomodoroSettings() {
  const focusValue = Number(elements.focusDurationInput.value);
  const breakValue = Number(elements.breakDurationInput.value);

  if (!focusValue || !breakValue) return;

  state.timerConfig.focusMinutes = Math.min(180, Math.max(1, focusValue));
  state.timerConfig.breakMinutes = Math.min(60, Math.max(1, breakValue));
  resetTimer();
  saveState();
}

function completeCycle() {
  ensureTodayStats();
  if (state.timer.mode === "focus") {
    state.dailyStats[getTodayKey()].focusSessions += 1;
    state.dailyStats[getTodayKey()].studyMinutes += 25;
    logSession("Focus");
  } else {
    logSession("Break");
  }
  playNotificationSound();
  switchTimerMode(state.timer.mode === "focus" ? "break" : "focus");
  saveState();
  updateStatsUI();
  renderChart();
  renderSessionHistory();
  renderStreakCalendar();
}

function startTimer() {
  if (state.timer.isRunning) return;
  state.timer.isRunning = true;
  state.timer.intervalId = setInterval(() => {
    if (state.timer.remainingSeconds > 0) {
      state.timer.remainingSeconds -= 1;
      updateTimerUI();
      saveState();
    } else {
      completeCycle();
    }
  }, 1000);
}

function pauseTimer() {
  if (!state.timer.isRunning) return;
  state.timer.isRunning = false;
  clearInterval(state.timer.intervalId);
  state.timer.intervalId = null;
  saveState();
}

function resetTimer() {
  pauseTimer();
  switchTimerMode("focus");
  saveState();
}

function getLastDates(n) {
  const dates = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d);
  }
  return dates;
}

function getAnalyticsData() {
  const dates = getLastDates(7);
  const labels = dates.map((d) => d.toLocaleDateString(undefined, { weekday: "short" }));
  const studyHours = dates.map((d) => Number(((state.dailyStats[getTodayKey(d)]?.studyMinutes || 0) / 60).toFixed(1)));
  const tasks = dates.map((d) => state.dailyStats[getTodayKey(d)]?.tasksCompleted || 0);
  return { labels, studyHours, tasks };
}

function renderChart() {
  const vars = getComputedStyle(document.body);
  const { labels, studyHours, tasks } = getAnalyticsData();
  if (state.chart) state.chart.destroy();

  state.chart = new Chart(elements.analyticsChart, {
    data: {
      labels,
      datasets: [
        {
          type: "line",
          label: "Study Hours",
          data: studyHours,
          borderColor: "#bc72ff",
          backgroundColor: "rgba(188, 114, 255, 0.2)",
          fill: true,
          borderWidth: 3,
          tension: 0.4,
          yAxisID: "y",
        },
        {
          type: "line",
          label: "Tasks Completed",
          data: tasks,
          borderColor: "#2de0af",
          backgroundColor: "rgba(45, 224, 175, 0.12)",
          fill: true,
          borderWidth: 2,
          tension: 0.35,
          yAxisID: "y1",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      resizeDelay: 120,
      animation: { duration: 350, easing: "easeOutQuart" },
      plugins: {
        legend: { labels: { color: vars.getPropertyValue("--muted") } },
      },
      scales: {
        x: { ticks: { color: vars.getPropertyValue("--muted") }, grid: { color: "rgba(160,171,225,0.14)" } },
        y: {
          beginAtZero: true,
          ticks: { color: vars.getPropertyValue("--muted") },
          grid: { color: "rgba(160,171,225,0.14)" },
        },
        y1: {
          beginAtZero: true,
          position: "right",
          ticks: { color: vars.getPropertyValue("--muted") },
          grid: { drawOnChartArea: false },
        },
      },
    },
  });
}

function renderStreakCalendar() {
  elements.streakCalendar.innerHTML = "";
  const days = getLastDates(28);
  days.forEach((date) => {
    const key = getTodayKey(date);
    const minutes = state.dailyStats[key]?.studyMinutes || 0;
    const level = minutes >= 180 ? 3 : minutes >= 90 ? 2 : minutes > 0 ? 1 : 0;
    const block = document.createElement("div");
    block.className = `calendar-day${level ? ` level-${level}` : ""}`;
    block.title = `${key}: ${minutes} min`;
    elements.streakCalendar.appendChild(block);
  });
}

function applyTheme(theme) {
  const isLight = theme === "light";
  document.body.classList.toggle("light-theme", isLight);
  if (elements.themeToggleText) elements.themeToggleText.textContent = isLight ? "Light" : "Dark";
  if (elements.themeToggleIcon) elements.themeToggleIcon.textContent = isLight ? "☀️" : "🌙";
  localStorage.setItem(STORAGE_KEYS.theme, theme);
}

function toggleTheme() {
  const isLight = document.body.classList.contains("light-theme");
  applyTheme(isLight ? "dark" : "light");
  renderChart();
}

function setQuote() {
  elements.quoteText.textContent = QUOTES[Math.floor(Math.random() * QUOTES.length)];
}

function bindSidebarNavigation() {
  const navButtons = Array.from(document.querySelectorAll(".nav-item[data-target]"));
  navButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const targetId = button.dataset.target;
      const targetEl = document.getElementById(targetId);
      if (!targetEl) return;

      navButtons.forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function bindEvents() {
  elements.taskForm.addEventListener("submit", handleTaskSubmit);
  elements.taskCancelBtn.addEventListener("click", resetTaskForm);
  elements.taskSearchInput.addEventListener("input", (event) => {
    state.taskSearch = event.target.value.trim();
    renderTasks();
  });
  elements.startTimerBtn.addEventListener("click", startTimer);
  elements.pauseTimerBtn.addEventListener("click", pauseTimer);
  elements.resetTimerBtn.addEventListener("click", resetTimer);
  elements.themeToggleBtn.addEventListener("click", toggleTheme);
  elements.newQuoteBtn.addEventListener("click", setQuote);
  elements.applyTimerSettingsBtn.addEventListener("click", applyPomodoroSettings);
  elements.saveGoalBtn.addEventListener("click", () => {
    const value = Number(elements.dailyGoalInput.value);
    if (value >= 30) {
      state.dailyGoalMinutes = value;
      saveState();
      updateStatsUI();
    }
  });
  bindSidebarNavigation();
}

function initTimerRing() {
  elements.timerProgressCircle.style.strokeDasharray = String(TIMER_RING_CIRCUMFERENCE);
  elements.timerProgressCircle.style.strokeDashoffset = String(TIMER_RING_CIRCUMFERENCE);
}

function init() {
  loadState();
  applyTheme(localStorage.getItem(STORAGE_KEYS.theme) || "dark");
  initTimerRing();
  elements.focusDurationInput.value = String(state.timerConfig.focusMinutes);
  elements.breakDurationInput.value = String(state.timerConfig.breakMinutes);
  elements.dailyGoalInput.value = String(state.dailyGoalMinutes);
  resetTaskForm();
  setQuote();
  updateTimerUI();
  updateStatsUI();
  renderTasks();
  renderChart();
  renderStreakCalendar();
  renderSessionHistory();
  bindEvents();
}

init();
