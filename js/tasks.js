import { readStore, writeStore } from "./storage.js";

const savedTasks = readStore("tasks", []);
let tasks = Array.isArray(savedTasks)
  ? savedTasks.filter((task) => task && typeof task.id === "string" && typeof task.title === "string" && typeof task.completed === "boolean" && ["low", "medium", "high"].includes(task.priority))
  : [];
let filter = "all";
const makeId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function getTasks() { return [...tasks]; }
export function clearTasks() { tasks = []; filter = "all"; }
export function setTaskFilter(value) { filter = value; }
export function getTaskFilter() { return filter; }

export function addTask(title, priority = "medium") {
  const clean = title.trim().slice(0, 120);
  if (!clean) return false;
  if (!["low", "medium", "high"].includes(priority)) priority = "medium";
  tasks.unshift({ id: makeId(), title: clean, priority, completed: false, createdAt: new Date().toISOString() });
  return writeStore("tasks", tasks);
}

export function toggleTask(id) {
  const task = tasks.find((item) => item.id === id);
  if (!task) return false;
  task.completed = !task.completed;
  return writeStore("tasks", tasks);
}

export function deleteTask(id) {
  tasks = tasks.filter((task) => task.id !== id);
  return writeStore("tasks", tasks);
}

export function updatePriority(id, priority) {
  if (!["low", "medium", "high"].includes(priority)) return false;
  const task = tasks.find((item) => item.id === id);
  if (!task) return false;
  task.priority = priority;
  return writeStore("tasks", tasks);
}

export function renderTasks(container, compact = false) {
  container.replaceChildren();
  const visible = tasks.filter((task) => filter === "all" || (filter === "pending" && !task.completed) || (filter === "completed" && task.completed));
  if (!visible.length) {
    const empty = document.createElement("p");
    empty.className = "empty-list";
    empty.textContent = filter === "completed" ? "No completed tasks yet." : filter === "pending" ? "You're all caught up." : "No tasks yet. Add one above.";
    container.append(empty);
  }
  visible.slice(0, compact ? 5 : visible.length).forEach((task) => {
    const row = document.createElement("div");
    row.className = compact ? "task-row" : "modal-task";
    const check = document.createElement("button");
    check.type = "button"; check.className = `task-check${task.completed ? " done" : ""}`;
    check.dataset.action = "toggle-task"; check.dataset.id = task.id; check.setAttribute("aria-label", task.completed ? "Mark task pending" : "Complete task");
    check.textContent = task.completed ? "✓" : "";
    const name = document.createElement("span");
    name.className = `task-name${task.completed ? " done" : ""}`; name.textContent = task.title;
    const priority = compact ? document.createElement("i") : document.createElement("select");
    if (compact) {
      priority.className = `task-priority priority-${task.priority}`;
      priority.setAttribute("aria-label", `${task.priority} priority`);
    } else {
      priority.dataset.action = "task-priority"; priority.dataset.id = task.id;
      ["low", "medium", "high"].forEach((value) => {
        const option = document.createElement("option"); option.value = value; option.textContent = `${value[0].toUpperCase()}${value.slice(1)} priority`; option.selected = task.priority === value; priority.append(option);
      });
    }
    const remove = document.createElement("button");
    remove.type = "button"; remove.className = "task-delete"; remove.dataset.action = "delete-task"; remove.dataset.id = task.id; remove.setAttribute("aria-label", `Delete ${task.title}`); remove.textContent = "×";
    row.append(check, name, priority, remove);
    container.append(row);
  });
  const openCount = tasks.filter((task) => !task.completed).length;
  const completeCount = tasks.length - openCount;
  const count = document.getElementById("task-count");
  const completed = document.getElementById("task-completed");
  const progress = document.getElementById("task-progress");
  if (count) count.textContent = String(openCount);
  if (completed) completed.textContent = `${completeCount} DONE`;
  if (progress) progress.style.width = `${tasks.length ? completeCount / tasks.length * 100 : 0}%`;
}
