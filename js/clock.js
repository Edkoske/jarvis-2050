import { getSettings } from "./settings.js";

export function updateClock() {
  const now = new Date();
  const hour12 = getSettings().clockFormat === "12";
  const time = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12 }).format(now);
  const shortTime = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", hour12 }).format(now);
  const date = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(now);
  const longDate = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(now);
  const setText = (id, value) => { const element = document.getElementById(id); if (element) element.textContent = value; };
  setText("header-time", time);
  setText("header-date", date);
  setText("long-date", longDate);
  setText("clock-display", shortTime);
  setText("clock-weekday", new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(now).toUpperCase());
  setText("clock-calendar-date", new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric", year: "numeric" }).format(now));
  setText("utc-time", new Intl.DateTimeFormat(undefined, { timeZone: "UTC", hour: "2-digit", minute: "2-digit", hour12 }).format(now));
  setText("timezone-label", Intl.DateTimeFormat().resolvedOptions().timeZone || "LOCAL");
  setText("utc-offset", offsetText(now));
  const hour = now.getHours();
  setText("greeting", hour < 12 ? "GOOD MORNING" : hour < 18 ? "GOOD AFTERNOON" : "GOOD EVENING");
}

function offsetText(date) {
  const minutes = -date.getTimezoneOffset();
  const sign = minutes >= 0 ? "+" : "-";
  return `${sign}${String(Math.floor(Math.abs(minutes) / 60)).padStart(2, "0")}:${String(Math.abs(minutes) % 60).padStart(2, "0")}`;
}

export function calendarMarkup(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();
  const cells = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((day) => `<span class="calendar-day-name">${day}</span>`);
  for (let index = 0; index < 42; index += 1) {
    let day = index - firstDay + 1;
    let className = "";
    if (day < 1) { day = prevDays + day; className = "other-month"; }
    else if (day > daysInMonth) { day -= daysInMonth; className = "other-month"; }
    else if (day === date.getDate()) className = "today";
    cells.push(`<span class="${className}">${day}</span>`);
  }
  return `<div class="calendar-head"><button class="secondary-button" data-action="calendar-shift" data-shift="-1" aria-label="Previous month">‹</button><strong>${new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(date)}</strong><button class="secondary-button" data-action="calendar-shift" data-shift="1" aria-label="Next month">›</button></div><div class="calendar-grid">${cells.join("")}</div>`;
}
