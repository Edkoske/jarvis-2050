import { updateClock, calendarMarkup } from "./clock.js";
import { fetchWeather } from "./weather.js";
import * as Tasks from "./tasks.js";
import * as Notes from "./notes.js";
import { getSettings, updateSetting, resetSettings, resetAll, applySettings } from "./settings.js";
import { processCommand } from "./commands.js";
import { startListening, stopListening, speak, getAvailableVoices, voiceSupported } from "./voice.js";
import { systemDetails, startSystemMonitor } from "./system.js";
import * as Music from "./music.js";

const $ = (selector, root = document) => root.querySelector(selector);
const modal = $("#app-modal");
const modalBody = $("#modal-body");
const backdrop = $("#modal-backdrop");
let activeApp = "";
let modalCleanup = null;
let lastFocused = null;
let calendarDate = new Date();
let taskFilter = "all";
let timerDeadline = 0;
let timerInterval = null;
let stopwatchStartedAt = 0;
let stopwatchElapsed = 0;
let stopwatchInterval = null;
let notificationItems = [];
let currentVoiceState = "idle";

const apps = {
  calculator: ["CALCULATOR", "Calculator", "∑"],
  notes: ["PERSONAL", "Quick notes", "▤"],
  calendar: ["SCHEDULE", "Calendar", "▦"],
  tasks: ["PRODUCTIVITY", "Task manager", "✓"],
  music: ["ENTERTAINMENT", "Music player", "♫"],
  browser: ["NAVIGATION", "Browser shortcuts", "↗"],
  system: ["DIAGNOSTICS", "System monitor", "⌁"],
  settings: ["PREFERENCES", "Settings", "⚙"],
  timer: ["TIME TOOLS", "Stopwatch & timer", "◷"],
  notifications: ["SYSTEM", "Notifications", "♧"]
};

function toast(message, error = false) {
  const item = document.createElement("div");
  item.className = `toast${error ? " error" : ""}`;
  item.textContent = message;
  $("#toast-region").append(item);
  window.setTimeout(() => item.remove(), 4200);
}

function setCoreState(state, message) {
  currentVoiceState = state;
  const stage = $("#core-stage");
  stage.dataset.state = state;
  $("#core-status").textContent = message || ({ idle: "SYSTEM STANDING BY", listening: "LISTENING FOR COMMAND", processing: "PROCESSING REQUEST", speaking: "RESPONDING" }[state] || "SYSTEM STANDING BY");
  $("#core-button").setAttribute("aria-label", state === "listening" ? "Stop voice assistant" : "Start voice assistant");
  document.querySelectorAll(".mic-button").forEach((button) => button.classList.toggle("listening", state === "listening"));
}

function renderConversation(role, text) {
  const conversation = $("#conversation");
  const row = document.createElement("div");
  row.className = `message ${role === "user" ? "user-message" : "assistant-message"}`;
  const avatar = document.createElement("span");
  avatar.className = "message-avatar";
  avatar.textContent = role === "user" ? "Y" : "J";
  const content = document.createElement("div");
  const meta = document.createElement("small");
  meta.textContent = role === "user" ? "YOU" : "JARVIS";
  const time = document.createElement("time");
  time.textContent = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date());
  meta.append(time);
  const paragraph = document.createElement("p");
  paragraph.textContent = text;
  content.append(meta, paragraph);
  row.append(avatar, content);
  conversation.append(row);
  conversation.scrollTop = conversation.scrollHeight;
  while (conversation.children.length > 36) conversation.firstElementChild.remove();
}

function renderTasksDashboard() {
  const activeFilter = Tasks.getTaskFilter();
  Tasks.setTaskFilter("all");
  Tasks.renderTasks($("#task-list"), true);
  Tasks.setTaskFilter(activeFilter);
  $("#notification-count").textContent = String(Tasks.getTasks().filter((task) => !task.completed).length);
}

function renderNotesList() {
  Notes.renderNotes($("#note-card-list"));
}

function notesMarkup() {
  return `<p class="modal-note">Notes are saved in this browser on this device. They are not sent to a server.</p>
    <form id="note-form"><label class="field-label" for="note-title">TITLE</label><input class="field" id="note-title" maxlength="100" required placeholder="A clear title">
    <label class="field-label" for="note-content">NOTE</label><textarea class="textarea-field" id="note-content" maxlength="5000" required placeholder="Write something worth remembering…"></textarea>
    <div class="form-row" style="margin-top:9px"><button class="primary-button" id="note-submit" type="submit">SAVE NOTE</button><button class="secondary-button" id="note-cancel" type="button" data-action="cancel-note" hidden>CANCEL EDIT</button></div></form>
    <div class="modal-toolbar" style="margin-top:18px"><input class="field" id="note-search" maxlength="100" placeholder="Search notes…"><span class="micro-label" id="note-total"></span></div>
    <div class="note-card-list" id="note-card-list"></div>`;
}

function tasksMarkup() {
  return `<p class="modal-note">Your task list is stored locally in this browser. Add tasks, set a priority, and track your progress.</p>
    <form id="modal-task-form" class="form-row"><input class="field" id="modal-task-input" maxlength="120" required placeholder="What needs doing?">
    <select class="select-field" id="modal-task-priority" aria-label="Task priority" style="width:145px"><option value="low">Low priority</option><option value="medium" selected>Medium priority</option><option value="high">High priority</option></select><button class="primary-button">ADD</button></form>
    <div class="filter-row"><button class="filter-button" data-action="task-filter" data-filter="all">All</button><button class="filter-button" data-action="task-filter" data-filter="pending">Pending</button><button class="filter-button" data-action="task-filter" data-filter="completed">Completed</button></div>
    <div id="modal-task-list" class="modal-task-list"></div>`;
}

function settingsMarkup() {
  const settings = getSettings();
  return `<p class="modal-note">Preferences are saved locally. Notes and tasks remain on this device. Weather requests go to Open-Meteo only when you search.</p>
    <section class="settings-section"><h3>APPEARANCE</h3>
      <label class="setting-row"><span>Interface theme<small>Choose the dashboard appearance</small></span><select class="select-field" data-setting="theme"><option value="dark" ${settings.theme === "dark" ? "selected" : ""}>Dark</option><option value="light" ${settings.theme === "light" ? "selected" : ""}>Light</option></select></label>
      <div class="setting-row"><span>Accent colour</span><div class="accent-options">${[["cyan", "#55dcff"], ["violet", "#b28bff"], ["blue", "#6e9bff"], ["green", "#68e6b2"]].map(([key, color]) => `<button class="accent-choice${settings.accent === key ? " selected" : ""}" type="button" data-action="accent" data-accent="${key}" aria-label="${key} accent" style="background:${color}"></button>`).join("")}</div></div>
      <label class="setting-row"><span>Animation intensity<small>Reduce motion or add energy</small></span><select class="select-field" data-setting="animationIntensity"><option value="reduced" ${settings.animationIntensity === "reduced" ? "selected" : ""}>Reduced</option><option value="standard" ${settings.animationIntensity === "standard" ? "selected" : ""}>Standard</option><option value="high" ${settings.animationIntensity === "high" ? "selected" : ""}>High</option></select></label>
      <label class="setting-row"><span>Clock format</span><select class="select-field" data-setting="clockFormat"><option value="24" ${settings.clockFormat === "24" ? "selected" : ""}>24-hour</option><option value="12" ${settings.clockFormat === "12" ? "selected" : ""}>12-hour</option></select></label>
    </section>
    <section class="settings-section"><h3>VOICE & AUDIO</h3>
      <label class="setting-row"><span>Spoken responses<small>Uses your browser's speech synthesis</small></span><input type="checkbox" data-setting="voiceOutput" ${settings.voiceOutput ? "checked" : ""}></label>
      <label class="setting-row"><span>System voice</span><span id="voice-select-slot"></span></label>
      <label class="setting-row"><span>Sound effects<small>Short interface sounds on interaction</small></span><input type="checkbox" data-setting="soundEffects" ${settings.soundEffects ? "checked" : ""}></label>
      <p class="modal-note">Microphone access is requested only when you activate voice input. Recognition availability depends on your browser.</p>
    </section>
    <section class="settings-section"><h3>DATA & PRIVACY</h3><div class="form-row"><button class="secondary-button" data-action="reset-settings">RESET SETTINGS</button><button class="danger-button" data-action="clear-data">CLEAR ALL LOCAL DATA</button></div></section>`;
}

function setNotesForm(note = null) {
  $("#note-title").value = note?.title || "";
  $("#note-content").value = note?.content || "";
  $("#note-submit").textContent = note ? "UPDATE NOTE" : "SAVE NOTE";
  $("#note-cancel").hidden = !note;
  if (note) $("#note-title").focus();
}

function renderCalendar() {
  $("#modal-body").innerHTML = calendarMarkup(calendarDate);
}

function renderSystem() {
  modalBody.innerHTML = `<p class="modal-note">Browser-reported values are marked <span style="color:var(--green)">ACTUAL</span>. The activity graph is simulated because browsers do not expose live CPU utilization to webpages.</p><div class="system-cards" id="system-cards"></div><canvas class="system-graph" id="system-graph" aria-label="Simulated system activity graph"></canvas><p class="micro-label" style="margin:9px 0 0">SIMULATED ACTIVITY · NOT AN ACTUAL CPU MEASUREMENT</p>`;
  const cards = $("#system-cards");
  systemDetails().forEach(([label, value, kind]) => {
    const card = document.createElement("div"); card.className = "system-card";
    const title = document.createElement("small"); title.textContent = label;
    const reading = document.createElement("b"); reading.textContent = value;
    const note = document.createElement("span"); note.className = "actual-tag"; note.textContent = kind.toUpperCase();
    card.append(title, reading, note); cards.append(card);
  });
  modalCleanup = startSystemMonitor($("#system-graph"));
  const onlineHandler = () => {
    const network = $("#system-cards")?.querySelector(".system-card:nth-child(4) b");
    if (network) network.textContent = navigator.onLine ? "Online" : "Offline";
  };
  window.addEventListener("online", onlineHandler);
  window.addEventListener("offline", onlineHandler);
  const previousCleanup = modalCleanup;
  modalCleanup = () => { previousCleanup(); window.removeEventListener("online", onlineHandler); window.removeEventListener("offline", onlineHandler); };
}

function renderMusic() {
  modalBody.innerHTML = `<div class="music-layout"><div><div class="music-now"><div class="album-art">♫</div><div class="audio-bars" id="audio-bars" role="img" aria-label="Audio frequency visualization">${Array.from({ length: 32 }, () => "<i></i>").join("")}</div><h3 id="music-title">No track selected</h3><p id="music-subtitle">Choose audio files from your device</p><input class="music-progress" id="music-progress" type="range" min="0" max="100" value="0" aria-label="Track position"><div class="music-times"><span id="music-current-time">0:00</span><span id="music-duration">0:00</span></div><div class="music-controls"><button data-action="music-prev" aria-label="Previous track">|◀</button><button class="play-toggle" data-action="music-toggle" aria-label="Play or pause">▶</button><button data-action="music-next" aria-label="Next track">▶|</button></div><div class="music-options"><button data-action="music-shuffle">SHUFFLE</button><button data-action="music-repeat">REPEAT</button></div><label class="volume-row">VOL <input id="music-volume" type="range" min="0" max="1" step=".01" value="${Music.getMusicState().volume}" aria-label="Volume"></label></div><label class="primary-button" style="display:inline-block;margin-top:12px;cursor:pointer">＋ ADD LOCAL AUDIO<input id="music-files" type="file" accept="audio/*" multiple hidden></label><p class="modal-note" style="margin:9px 0 0">Audio stays in this tab and is not uploaded. No music is bundled.</p></div><div><p class="eyebrow">PLAYLIST</p><div class="playlist" id="playlist"></div></div></div>`;
  const update = () => updateMusicUI();
  modalCleanup = Music.bindMusicUpdates(update);
  updateMusicUI();
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

function updateMusicUI() {
  if (activeApp !== "music") return;
  const state = Music.getMusicState();
  const track = state.tracks[state.currentIndex];
  $("#music-title").textContent = track?.name || "No track selected";
  $("#music-subtitle").textContent = track ? "LOCAL AUDIO FILE" : "Choose audio files from your device";
  $(".play-toggle").textContent = state.playing ? "Ⅱ" : "▶";
  ["music-prev", "music-toggle", "music-next"].forEach((action) => {
    const control = document.querySelector(`[data-action="${action}"]`);
    if (control) control.disabled = state.tracks.length === 0;
  });
  $("#music-progress").max = String(state.duration || 100);
  $("#music-progress").value = String(Math.min(state.currentTime, state.duration || 100));
  $("#music-current-time").textContent = formatDuration(state.currentTime);
  $("#music-duration").textContent = formatDuration(state.duration);
  $("#music-volume").value = String(state.volume);
  const bars = $("#audio-bars")?.children;
  if (bars) Array.from(bars).forEach((bar, index) => {
    const level = state.playing ? (state.frequencies[index] || 0) / 255 : 0;
    bar.style.height = `${2 + level * 24}px`;
    bar.style.opacity = String(.25 + level * .75);
  });
  document.querySelector('[data-action="music-shuffle"]').classList.toggle("active", state.shuffle);
  document.querySelector('[data-action="music-repeat"]').classList.toggle("active", state.repeat);
  const playlist = $("#playlist");
  playlist.replaceChildren();
  state.tracks.forEach((item, index) => {
    const row = document.createElement("div"); row.className = `playlist-item${index === state.currentIndex ? " active" : ""}`;
    row.dataset.action = "music-select"; row.dataset.index = String(index); row.setAttribute("role", "button"); row.tabIndex = 0;
    const icon = document.createElement("b"); icon.textContent = index === state.currentIndex && state.playing ? "♫" : "♪";
    const name = document.createElement("span"); name.textContent = item.name;
    row.append(icon, name); playlist.append(row);
  });
  if (!state.tracks.length) {
    const empty = document.createElement("p"); empty.className = "empty-list"; empty.textContent = "Your playlist is empty."; playlist.append(empty);
  }
}

function timerMarkup() {
  return `<p class="modal-note">A local timer and stopwatch. The countdown continues while this window is open.</p><div class="timer-inputs"><label class="sr-only" for="timer-minutes">Minutes</label><input class="field" id="timer-minutes" type="number" min="0" max="9999" value="5" aria-label="Minutes"><label class="sr-only" for="timer-seconds">Seconds</label><input class="field" id="timer-seconds" type="number" min="0" max="59" value="0" aria-label="Seconds"></div><div class="timer-display" id="timer-display">00:00</div><div class="timer-controls"><button class="primary-button" data-action="timer-start">START TIMER</button><button class="secondary-button" data-action="timer-reset">RESET</button></div><section class="settings-section" style="margin-top:24px"><h3>STOPWATCH</h3><div class="timer-display" id="stopwatch-display">00:00.00</div><div class="timer-controls"><button class="primary-button" data-action="stopwatch-start">START</button><button class="secondary-button" data-action="stopwatch-lap">LAP</button><button class="secondary-button" data-action="stopwatch-reset">RESET</button></div><div class="stopwatch-laps" id="stopwatch-laps"></div></section>`;
}

function renderTimer() {
  modalBody.innerHTML = timerMarkup();
  updateTimerUI();
  timerInterval = window.setInterval(updateTimerUI, 150);
  stopwatchInterval = window.setInterval(updateTimerUI, 40);
  modalCleanup = () => { window.clearInterval(timerInterval); window.clearInterval(stopwatchInterval); };
}

function updateTimerUI() {
  const timer = $("#timer-display");
  if (timer) {
    const remaining = Math.max(0, Math.ceil((timerDeadline - Date.now()) / 1000));
    timer.textContent = `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;
    if (timerDeadline && remaining === 0) { timerDeadline = 0; toast("Countdown complete."); }
  }
  const watch = $("#stopwatch-display");
  if (watch) {
    const elapsed = stopwatchElapsed + (stopwatchStartedAt ? Date.now() - stopwatchStartedAt : 0);
    const centiseconds = Math.floor(elapsed / 10) % 100;
    const seconds = Math.floor(elapsed / 1000) % 60;
    const minutes = Math.floor(elapsed / 60000);
    watch.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`;
  }
}

function notificationsMarkup() {
  return `<p class="modal-note">JARVIS system notifications for this session.</p><div class="note-card-list" id="notification-list"></div>`;
}

function openApp(name) {
  if (!apps[name]) return;
  closeModal(false);
  activeApp = name;
  lastFocused = document.activeElement;
  modal.classList.remove("minimized");
  const [category, title, icon] = apps[name];
  $("#modal-category").textContent = category;
  $("#modal-title").textContent = title;
  $("#modal-icon").textContent = icon;
  modalBody.innerHTML = "";
  switch (name) {
    case "notes": modalBody.innerHTML = notesMarkup(); renderNotesList(); $("#note-total").textContent = `${Notes.getNotes().length} NOTES`; break;
    case "tasks":
      modalBody.innerHTML = tasksMarkup(); taskFilter = "all"; Tasks.setTaskFilter(taskFilter); renderModalTasks(); break;
    case "calendar": calendarDate = new Date(); renderCalendar(); break;
    case "calculator": modalBody.innerHTML = calculatorMarkup(); break;
    case "settings":
      modalBody.innerHTML = settingsMarkup();
      $("#voice-select-slot").replaceWith(createVoiceSelect());
      break;
    case "system": renderSystem(); break;
    case "music": renderMusic(); break;
    case "timer": renderTimer(); break;
    case "browser": modalBody.innerHTML = browserMarkup(); break;
    case "notifications": modalBody.innerHTML = notificationsMarkup(); renderNotifications(); break;
  }
  backdrop.hidden = false;
  document.body.style.overflow = "hidden";
  const focusable = modal.querySelector("button, input, select, textarea");
  if (focusable) focusable.focus();
}

function createVoiceSelect() {
  const select = document.createElement("select"); select.className = "select-field"; select.dataset.setting = "voiceURI"; select.setAttribute("aria-label", "Speech voice");
  const settings = getSettings();
  const voices = getAvailableVoices();
  const option = document.createElement("option"); option.value = ""; option.textContent = voices.length ? "Browser default" : "Browser default (voices unavailable)"; select.append(option);
  voices.forEach((voice) => { const item = document.createElement("option"); item.value = voice.voiceURI; item.textContent = `${voice.name} · ${voice.lang}`; item.selected = voice.voiceURI === settings.voiceURI; select.append(item); });
  return select;
}

function closeModal(restoreFocus = true) {
  if (modalCleanup) { modalCleanup(); modalCleanup = null; }
  activeApp = "";
  backdrop.hidden = true;
  document.body.style.overflow = "";
  if (restoreFocus && lastFocused instanceof HTMLElement) lastFocused.focus();
}

function renderModalTasks() {
  Tasks.setTaskFilter(taskFilter);
  Tasks.renderTasks($("#modal-task-list"));
  document.querySelectorAll(".filter-button").forEach((button) => button.classList.toggle("active", button.dataset.filter === taskFilter));
}

function renderNotifications() {
  const list = $("#notification-list");
  list.replaceChildren();
  const openTasks = Tasks.getTasks().filter((task) => !task.completed).length;
  const messages = [...notificationItems];
  if (openTasks) messages.unshift(`${openTasks} task${openTasks === 1 ? "" : "s"} still open.`);
  if (!messages.length) {
    const empty = document.createElement("p"); empty.className = "empty-list"; empty.textContent = "You're all caught up."; list.append(empty); return;
  }
  messages.forEach((message) => { const item = document.createElement("article"); item.className = "note-card"; const text = document.createElement("p"); text.textContent = message; item.append(text); list.append(item); });
}

function browserMarkup() {
  return `<p class="modal-note">Open external sites in a new browser tab. JARVIS does not browse or read pages on your behalf.</p><div class="note-card-list"><button class="note-card secondary-button" data-action="external-link" data-url="https://www.google.com/">↗ &nbsp; Google Search</button><button class="note-card secondary-button" data-action="external-link" data-url="https://www.wikipedia.org/">↗ &nbsp; Wikipedia</button><button class="note-card secondary-button" data-action="external-link" data-url="https://www.openstreetmap.org/">↗ &nbsp; OpenStreetMap</button></div>`;
}

function calculatorMarkup() {
  const keys = ["AC", "±", "%", "÷", "7", "8", "9", "×", "4", "5", "6", "−", "1", "2", "3", "+", "⌫", "0", ".", "="];
  return `<div class="calculator"><div class="calculator-display"><small id="calc-expression"></small><span id="calc-result">0</span></div><div class="calculator-grid">${keys.map((key) => `<button class="calc-key${["÷", "×", "−", "+", "%"].includes(key) ? " operator" : ""}${key === "=" ? " equals" : ""}" data-action="calc-key" data-key="${key}">${key}</button>`).join("")}</div></div>`;
}

let calcExpression = "";
function evaluateExpression(expression) {
  const tokens = expression.match(/\d*\.?\d+|[()+\-*/%]/g);
  if (!tokens || tokens.join("") !== expression.replace(/\s/g, "")) throw new Error("Invalid expression");
  let position = 0;
  const factor = () => {
    const token = tokens[position++];
    if (token === "-") return -factor();
    if (token === "+") return factor();
    if (token === "(") { const result = sum(); if (tokens[position++] !== ")") throw new Error("Missing parenthesis"); return result; }
    const number = Number(token);
    if (!Number.isFinite(number)) throw new Error("Invalid number");
    return number;
  };
  const product = () => {
    let value = factor();
    while (["*", "/", "%"].includes(tokens[position])) {
      const operator = tokens[position++]; const next = factor();
      if ((operator === "/" || operator === "%") && next === 0) throw new Error("Cannot divide by zero");
      value = operator === "*" ? value * next : operator === "/" ? value / next : value % next;
    }
    return value;
  };
  const sum = () => {
    let value = product();
    while (tokens[position] === "+" || tokens[position] === "-") { const operator = tokens[position++]; const next = product(); value = operator === "+" ? value + next : value - next; }
    return value;
  };
  const result = sum();
  if (position !== tokens.length || !Number.isFinite(result)) throw new Error("Invalid calculation");
  return result;
}

function handleCalculatorKey(key) {
  const result = $("#calc-result");
  const expression = $("#calc-expression");
  if (!result || !expression) return;
  if (key === "AC") { calcExpression = ""; expression.textContent = ""; result.textContent = "0"; return; }
  if (key === "⌫") { calcExpression = calcExpression.slice(0, -1); expression.textContent = calcExpression; result.textContent = calcExpression || "0"; return; }
  if (key === "=") {
    try { const answer = evaluateExpression(calcExpression.replaceAll("×", "*").replaceAll("÷", "/").replaceAll("−", "-")); expression.textContent = calcExpression; result.textContent = String(Number(answer.toPrecision(10))); calcExpression = String(answer); }
    catch (error) { result.textContent = error.message === "Cannot divide by zero" ? "Cannot divide by 0" : "Invalid"; }
    return;
  }
  if (key === "±") { if (calcExpression) calcExpression = calcExpression.startsWith("-") ? calcExpression.slice(1) : `-${calcExpression}`; }
  else calcExpression += ({ "×": "*", "÷": "/", "−": "-" }[key] || key);
  expression.textContent = calcExpression;
  result.textContent = calcExpression;
}

async function submitCommand(text) {
  const clean = text.trim().slice(0, 240);
  if (!clean) return;
  renderConversation("user", clean);
  setCoreState("processing");
  $("#typing-indicator").classList.add("visible");
  const context = {
    theme: getSettings().theme,
    setTheme: (theme) => { updateSetting("theme", theme); if (activeApp === "settings") openApp("settings"); },
    openApp,
    toggleFullscreen,
    openLink: (url) => window.open(url, "_blank", "noopener,noreferrer"),
    toast,
    speak
  };
  const response = await processCommand(clean, context);
  $("#typing-indicator").classList.remove("visible");
  renderConversation("assistant", response.text);
  if (response.app) openApp(response.app);
  if (response.action === "fullscreen") toggleFullscreen();
  if (response.action === "weather") $("#weather-location").focus();
  if (getSettings().voiceOutput) {
    setCoreState("speaking");
    if (!speak(response.text, (state) => setCoreState(state))) setCoreState("idle");
    else window.setTimeout(() => { if (currentVoiceState === "speaking") setCoreState("idle"); }, 15000);
  } else setCoreState("idle");
}

function toggleFullscreen() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch((error) => toast(`Fullscreen unavailable: ${error.message}`, true));
  else document.exitFullscreen?.().catch((error) => toast(`Could not exit fullscreen: ${error.message}`, true));
}

function toggleVoice() {
  if (!voiceSupported()) { toast("Voice recognition isn't supported in this browser. Type a command instead.", true); return; }
  try {
    startListening((transcript) => {
      $("#command-input").value = transcript;
      $("#command-form").requestSubmit();
    }, (state, message) => {
      if (state === "error") { setCoreState("idle"); toast(message, true); }
      else setCoreState(state);
    });
  } catch (error) { toast(error.message, true); }
}

function playSound() {
  if (!getSettings().soundEffects) return;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const audio = new AudioContextClass();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = "sine"; oscillator.frequency.value = 620;
    gain.gain.setValueAtTime(.035, audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .07);
    oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(); oscillator.stop(audio.currentTime + .07);
    oscillator.onended = () => audio.close();
  } catch { /* Audio may be unavailable or blocked by browser policy. */ }
}

function updateTaskPriority(select) {
  if (!Tasks.updatePriority(select.dataset.id, select.value)) toast("Could not update task priority.", true);
  renderTasksDashboard();
  if (activeApp === "tasks") renderModalTasks();
}

document.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) {
    if (modal.classList.contains("minimized") && event.target.closest(".modal-header")) modal.classList.remove("minimized");
    return;
  }
  playSound();
  switch (target.dataset.action) {
    case "toggle-nav": {
      const nav = $("#primary-nav"); const expanded = nav.classList.toggle("open");
      target.setAttribute("aria-expanded", String(expanded)); break;
    }
    case "navigate": document.querySelectorAll(".nav-link").forEach((link) => link.classList.toggle("active", link === target)); $("#primary-nav").classList.remove("open"); break;
    case "open-app": openApp(target.dataset.app); break;
    case "notifications": openApp("notifications"); break;
    case "fullscreen": toggleFullscreen(); break;
    case "weather-refresh": {
      const location = $("#weather-location").value.trim();
      if (location) fetchWeather(location);
      else $("#weather-location").focus();
      break;
    }
    case "voice": if (currentVoiceState === "listening") stopListening(); else toggleVoice(); break;
    case "close-modal": closeModal(); break;
    case "minimize-modal": modal.classList.toggle("minimized"); break;
    case "cancel-note": Notes.cancelEdit(); setNotesForm(); break;
    case "edit-note": { const note = Notes.editNote(target.dataset.id); if (note) setNotesForm(note); break; }
    case "delete-note": if (window.confirm("Delete this note?")) { Notes.deleteNote(target.dataset.id); renderNotesList(); $("#note-total").textContent = `${Notes.getNotes().length} NOTES`; } break;
    case "toggle-task": Tasks.toggleTask(target.dataset.id); renderTasksDashboard(); if (activeApp === "tasks") renderModalTasks(); break;
    case "delete-task": Tasks.deleteTask(target.dataset.id); renderTasksDashboard(); if (activeApp === "tasks") renderModalTasks(); break;
    case "task-filter": taskFilter = target.dataset.filter; renderModalTasks(); break;
    case "calendar-shift": calendarDate.setMonth(calendarDate.getMonth() + Number(target.dataset.shift)); renderCalendar(); break;
    case "accent": updateSetting("accent", target.dataset.accent); openApp("settings"); break;
    case "reset-settings": if (window.confirm("Reset preferences to their defaults? Your notes and tasks will remain.")) { resetSettings(); openApp("settings"); toast("Settings reset."); } break;
    case "clear-data":
      if (window.confirm("Clear all JARVIS notes, tasks, and preferences stored in this browser? This cannot be undone.")) {
        if (resetAll()) {
          Notes.clearNotes();
          Tasks.clearTasks();
          renderTasksDashboard();
          openApp("settings");
          toast("Local JARVIS data cleared.");
        } else toast("Could not clear local JARVIS data.", true);
      }
      break;
    case "external-link": window.open(target.dataset.url, "_blank", "noopener,noreferrer"); break;
    case "calc-key": handleCalculatorKey(target.dataset.key); break;
    case "timer-start": {
      const minutes = Number($("#timer-minutes").value); const seconds = Number($("#timer-seconds").value);
      if (!Number.isInteger(minutes) || minutes < 0 || minutes > 9999 || !Number.isInteger(seconds) || seconds < 0 || seconds > 59 || minutes * 60 + seconds < 1) { toast("Enter a duration between 1 second and 9999 minutes.", true); break; }
      timerDeadline = Date.now() + (minutes * 60 + seconds) * 1000; break;
    }
    case "timer-reset": timerDeadline = 0; break;
    case "stopwatch-start": if (stopwatchStartedAt) { stopwatchElapsed += Date.now() - stopwatchStartedAt; stopwatchStartedAt = 0; target.textContent = "RESUME"; } else { stopwatchStartedAt = Date.now(); target.textContent = "PAUSE"; } break;
    case "stopwatch-lap": { const laps = $("#stopwatch-laps"); if (laps) { const item = document.createElement("div"); item.textContent = `LAP ${laps.children.length + 1} · ${$("#stopwatch-display").textContent}`; laps.prepend(item); } break; }
    case "stopwatch-reset": stopwatchStartedAt = 0; stopwatchElapsed = 0; $("#stopwatch-laps").replaceChildren(); $(".timer-controls [data-action='stopwatch-start']").textContent = "START"; updateTimerUI(); break;
    case "music-toggle": try { if (!Music.getMusicState().tracks.length) { toast("Add a local audio file to start playback."); break; } await Music.togglePlayback(); updateMusicUI(); } catch (error) { toast(`Audio playback failed: ${error.message}`, true); } break;
    case "music-next":
    case "music-prev":
      try { await Music.nextTrack(target.dataset.action === "music-prev"); }
      catch (error) { toast(`Audio playback failed: ${error.message}`, true); }
      break;
    case "music-shuffle": Music.toggleShuffle(); updateMusicUI(); break;
    case "music-repeat": Music.toggleRepeat(); updateMusicUI(); break;
    case "music-select": Music.selectTrack(Number(target.dataset.index)); try { await Music.togglePlayback(); } catch (error) { toast(`Audio playback failed: ${error.message}`, true); } updateMusicUI(); break;
  }
});

document.addEventListener("submit", (event) => {
  if (event.target.id === "command-form") {
    event.preventDefault();
    const input = $("#command-input"); const value = input.value;
    input.value = "";
    submitCommand(value);
  } else if (event.target.id === "task-form" || event.target.id === "modal-task-form") {
    event.preventDefault();
    const isDashboard = event.target.id === "task-form";
    const input = $(isDashboard ? "#task-input" : "#modal-task-input");
    const priority = isDashboard ? "medium" : $("#modal-task-priority").value;
    if (!Tasks.addTask(input.value, priority)) { toast("Task could not be saved. Check local storage availability.", true); return; }
    input.value = ""; renderTasksDashboard(); if (activeApp === "tasks") renderModalTasks();
  } else if (event.target.id === "note-form") {
    event.preventDefault();
    const result = Notes.saveNote($("#note-title").value, $("#note-content").value);
    if (!result) { toast("Note could not be saved. Add a title and content, then check local storage availability.", true); return; }
    setNotesForm(); renderNotesList(); $("#note-total").textContent = `${Notes.getNotes().length} NOTES`; toast("Note saved locally.");
  } else if (event.target.id === "weather-form") {
    event.preventDefault(); fetchWeather($("#weather-location").value);
  }
});

document.addEventListener("change", (event) => {
  const target = event.target;
  if (target.matches("[data-setting]")) {
    const value = target.type === "checkbox" ? target.checked : target.value;
    if (!updateSetting(target.dataset.setting, value)) toast("Preference could not be saved.", true);
    if (target.dataset.setting === "clockFormat") updateClock();
    if (target.dataset.setting === "animationIntensity") $("#particle-field").style.display = value === "reduced" ? "none" : "";
  }
  if (target.matches("[data-action='task-priority']")) updateTaskPriority(target);
  if (target.id === "music-files") {
    const result = Music.addMusicFiles(target.files);
    if (result.rejected) toast(`${result.rejected} file(s) skipped. Choose audio files only.`, true);
    if (result.added) {
      if (Music.getMusicState().currentIndex === 0) Music.selectTrack(0);
      updateMusicUI(); toast(`${result.added} local audio file(s) added.`);
    }
    target.value = "";
  }
  if (target.id === "music-volume") Music.setMusicVolume(target.value);
});

document.addEventListener("input", (event) => {
  if (event.target.id === "note-search") { Notes.setSearch(event.target.value); renderNotesList(); }
  if (event.target.id === "music-progress") Music.seekMusic(Number(event.target.value));
});

backdrop.addEventListener("click", (event) => { if (event.target === backdrop) closeModal(); });
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !backdrop.hidden) closeModal();
  if (event.key === "Enter" && event.target.matches(".playlist-item")) {
    event.preventDefault(); Music.selectTrack(Number(event.target.dataset.index)); Music.togglePlayback().catch((error) => toast(error.message, true));
  }
});

window.addEventListener("jarvis-storage-error", (event) => {
  const operation = event.detail?.operation || "access";
  toast(`Could not ${operation} local JARVIS data. Browser storage may be unavailable or full.`, true);
});
window.addEventListener("jarvis-music-error", (event) => toast(`Audio playback failed: ${event.detail?.message || "unknown error"}`, true));

let particleFrame = 0;
function startParticles() {
  const canvas = $("#particle-field");
  const ctx = canvas.getContext("2d");
  if (!ctx || window.matchMedia("(prefers-reduced-motion: reduce)").matches || getSettings().animationIntensity === "reduced") return;
  let particles = [];
  const resize = () => {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * ratio; canvas.height = window.innerHeight * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    particles = Array.from({ length: Math.min(75, Math.floor(window.innerWidth / 18)) }, () => ({ x: Math.random() * innerWidth, y: Math.random() * innerHeight, speed: .08 + Math.random() * .28, alpha: .12 + Math.random() * .35, radius: .5 + Math.random() * .8 }));
  };
  const draw = () => {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    particles.forEach((particle) => {
      particle.y -= particle.speed;
      if (particle.y < -3) { particle.y = innerHeight + 3; particle.x = Math.random() * innerWidth; }
      ctx.beginPath(); ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(99, 196, 255, ${particle.alpha})`; ctx.fill();
    });
    particleFrame = requestAnimationFrame(draw);
  };
  resize(); window.addEventListener("resize", resize); draw();
  window.addEventListener("beforeunload", () => { cancelAnimationFrame(particleFrame); window.removeEventListener("resize", resize); Music.releaseMusic(); }, { once: true });
}

applySettings();
updateClock();
window.setInterval(updateClock, 1000);
renderTasksDashboard();
startParticles();
