import { readStore, writeStore } from "./storage.js";

const savedNotes = readStore("notes", []);
let notes = Array.isArray(savedNotes)
  ? savedNotes.filter((note) => note && typeof note.id === "string" && typeof note.title === "string" && typeof note.content === "string" && typeof note.updatedAt === "string")
  : [];
let searchTerm = "";
let editingId = null;
const makeId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function getNotes() { return [...notes]; }
export function clearNotes() { notes = []; searchTerm = ""; editingId = null; }
export function setSearch(value) { searchTerm = value.trim().toLocaleLowerCase(); }
export function getEditingId() { return editingId; }
export function editNote(id) { editingId = id; return notes.find((note) => note.id === id) || null; }
export function cancelEdit() { editingId = null; }

export function saveNote(title, content) {
  const cleanTitle = title.trim().slice(0, 100);
  const cleanContent = content.trim().slice(0, 5000);
  if (!cleanTitle || !cleanContent) return false;
  const now = new Date().toISOString();
  if (editingId) {
    const existing = notes.find((note) => note.id === editingId);
    if (!existing) { editingId = null; return false; }
    existing.title = cleanTitle;
    existing.content = cleanContent;
    existing.updatedAt = now;
  } else {
    notes.unshift({ id: makeId(), title: cleanTitle, content: cleanContent, createdAt: now, updatedAt: now });
  }
  editingId = null;
  return writeStore("notes", notes);
}

export function deleteNote(id) {
  notes = notes.filter((note) => note.id !== id);
  if (editingId === id) editingId = null;
  return writeStore("notes", notes);
}

export function renderNotes(container) {
  container.replaceChildren();
  const filtered = notes.filter((note) => `${note.title} ${note.content}`.toLocaleLowerCase().includes(searchTerm));
  if (!filtered.length) {
    const empty = document.createElement("p");
    empty.className = "empty-list";
    empty.textContent = searchTerm ? "No notes match your search." : "No notes yet. Create your first note above.";
    container.append(empty);
    return;
  }
  filtered.forEach((note) => {
    const article = document.createElement("article");
    article.className = "note-card";
    const content = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = note.title;
    const body = document.createElement("p");
    body.textContent = note.content;
    const meta = document.createElement("div");
    meta.className = "note-meta";
    meta.textContent = `UPDATED ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(note.updatedAt))}`;
    content.append(title, body, meta);
    const actions = document.createElement("div");
    actions.className = "note-actions";
    const edit = document.createElement("button");
    edit.type = "button"; edit.dataset.action = "edit-note"; edit.dataset.id = note.id; edit.textContent = "EDIT";
    const remove = document.createElement("button");
    remove.type = "button"; remove.dataset.action = "delete-note"; remove.dataset.id = note.id; remove.textContent = "DELETE";
    actions.append(edit, remove);
    article.append(content, actions);
    container.append(article);
  });
}
