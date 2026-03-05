// 간단한 비밀번호 (개인용이므로 코드 안에 두는 방식)
const EDIT_PASSWORD = "myschedule123"; // 원하면 나중에 바꿔 쓰세요.
const STORAGE_KEY = "myschedule_todos_v1";
const UNLOCK_KEY = "myschedule_unlocked_v1";

let todos = [];
let isUnlocked = false;

const elements = {
  passwordInput: document.getElementById("password-input"),
  unlockBtn: document.getElementById("unlock-btn"),
  lockBtn: document.getElementById("lock-btn"),
  lockStatus: document.getElementById("lock-status"),

  todoForm: document.getElementById("todo-form"),
  titleInput: document.getElementById("title-input"),
  deadlineInput: document.getElementById("deadline-input"),
  priorityInput: document.getElementById("priority-input"),
  resetFormBtn: document.getElementById("reset-form-btn"),

  filterSelect: document.getElementById("filter-select"),
  todoList: document.getElementById("todo-list"),
  todoListEmpty: document.getElementById("todo-list-empty"),
  exportJsonBtn: document.getElementById("export-json-btn"),
};

let editingId = null;

function safeParseDate(value) {
  if (!value) return null;
  const t = Date.parse(value);
  if (Number.isNaN(t)) return null;
  return new Date(t);
}

function compareTodos(a, b) {
  const dateA = safeParseDate(a.deadline);
  const dateB = safeParseDate(b.deadline);

  if (!dateA && dateB) return 1;
  if (dateA && !dateB) return -1;
  if (dateA && dateB) {
    const diff = dateA - dateB;
    if (diff !== 0) return diff;
  }

  const pa = Number(a.priority) || 999;
  const pb = Number(b.priority) || 999;
  if (pa !== pb) return pa - pb;

  return (a.id || 0) - (b.id || 0);
}

function getTodayString() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function isOverdue(deadline) {
  const date = safeParseDate(deadline);
  if (!date) return false;
  const today = new Date(getTodayString());
  return date < today;
}

function isDueSoon(deadline) {
  const date = safeParseDate(deadline);
  if (!date) return false;
  const today = new Date(getTodayString());
  const diffDays = (date - today) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= 2;
}

function saveToLocalStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  } catch (e) {
    console.warn("localStorage 저장 실패", e);
  }
}

function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      todos = parsed;
    }
  } catch (e) {
    console.warn("localStorage 불러오기 실패", e);
  }
}

async function loadFromFile() {
  try {
    const res = await fetch("data/todos.json", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    if (Array.isArray(data) && todos.length === 0) {
      todos = data;
    }
  } catch (e) {
    console.warn("data/todos.json 불러오기 실패 (처음 설정 시 정상일 수 있음)", e);
  }
}

function updateLockUI() {
  if (isUnlocked) {
    elements.lockStatus.textContent = "현재 상태: 잠금 해제됨";
    elements.lockStatus.classList.remove("lock-status--locked");
    elements.lockStatus.classList.add("lock-status--unlocked");
  } else {
    elements.lockStatus.textContent = "현재 상태: 잠김";
    elements.lockStatus.classList.remove("lock-status--unlocked");
    elements.lockStatus.classList.add("lock-status--locked");
  }

  const disabled = !isUnlocked;
  elements.titleInput.disabled = disabled;
  elements.deadlineInput.disabled = disabled;
  elements.priorityInput.disabled = disabled;
  elements.resetFormBtn.disabled = disabled;
  elements.todoForm.querySelector("button[type='submit']").disabled = disabled;

  const actionButtons = document.querySelectorAll(".todo-actions button");
  actionButtons.forEach((btn) => {
    btn.disabled = disabled;
  });
}

function renderTodos() {
  if (!elements.todoList) return;

  const filter = elements.filterSelect.value;
  const todayStr = getTodayString();

  const sorted = [...todos].sort(compareTodos);

  const filtered = sorted.filter((todo) => {
    if (filter === "today") {
      return todo.deadline === todayStr && !todo.done;
    }
    if (filter === "pending") {
      return !todo.done;
    }
    if (filter === "done") {
      return !!todo.done;
    }
    return true;
  });

  elements.todoList.innerHTML = "";

  if (filtered.length === 0) {
    elements.todoListEmpty.style.display = "block";
    return;
  }

  elements.todoListEmpty.style.display = "none";

  filtered.forEach((todo) => {
    const item = document.createElement("div");
    item.className = "todo-item";

    if (!todo.done) {
      if (isOverdue(todo.deadline)) {
        item.classList.add("overdue");
      } else if (isDueSoon(todo.deadline)) {
        item.classList.add("due-soon");
      }
    }

    const main = document.createElement("div");
    main.className = "todo-main";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "todo-checkbox";
    checkbox.checked = !!todo.done;
    checkbox.addEventListener("change", () => {
      todo.done = checkbox.checked;
      saveToLocalStorage();
      renderTodos();
    });

    const content = document.createElement("div");
    content.className = "todo-content";

    const title = document.createElement("div");
    title.className = "todo-title";
    title.textContent = todo.title;
    if (todo.done) {
      title.classList.add("done");
    }

    const meta = document.createElement("div");
    meta.className = "todo-meta";

    if (todo.deadline) {
      const badgeDeadline = document.createElement("span");
      badgeDeadline.className = "badge badge-deadline";
      badgeDeadline.textContent = `마감일: ${todo.deadline}`;
      meta.appendChild(badgeDeadline);
    }

    const prioBadge = document.createElement("span");
    prioBadge.className = "badge badge-priority";
    const prioNum = Number(todo.priority) || 0;
    if (prioNum === 1 || prioNum === 2) {
      prioBadge.classList.add("badge-priority-high");
    }
    prioBadge.textContent = `우선순위: ${todo.priority ?? "-"}`;
    meta.appendChild(prioBadge);

    const statusBadge = document.createElement("span");
    statusBadge.className = "badge badge-status-pending";
    if (todo.done) {
      statusBadge.classList.add("badge-status-done");
      statusBadge.textContent = "완료";
    } else if (isOverdue(todo.deadline)) {
      statusBadge.textContent = "지남";
    } else if (isDueSoon(todo.deadline)) {
      statusBadge.textContent = "임박";
    } else {
      statusBadge.textContent = "진행 중";
    }
    meta.appendChild(statusBadge);

    content.appendChild(title);
    content.appendChild(meta);

    main.appendChild(checkbox);
    main.appendChild(content);

    const actions = document.createElement("div");
    actions.className = "todo-actions";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.textContent = "수정";
    editBtn.className = "edit-btn";
    editBtn.addEventListener("click", () => {
      if (!isUnlocked) return;
      startEdit(todo.id);
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.textContent = "삭제";
    deleteBtn.className = "delete-btn";
    deleteBtn.addEventListener("click", () => {
      if (!isUnlocked) return;
      const ok = confirm("정말로 이 할 일을 삭제하시겠습니까?");
      if (!ok) return;
      todos = todos.filter((t) => t.id !== todo.id);
      saveToLocalStorage();
      renderTodos();
    });

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    item.appendChild(main);
    item.appendChild(actions);

    elements.todoList.appendChild(item);
  });

  updateLockUI();
}

function resetForm() {
  editingId = null;
  elements.todoForm.reset();
  elements.priorityInput.value = "3";
  const submitBtn = elements.todoForm.querySelector("button[type='submit']");
  submitBtn.textContent = "추가";
}

function startEdit(id) {
  const todo = todos.find((t) => t.id === id);
  if (!todo) return;
  editingId = id;
  elements.titleInput.value = todo.title || "";
  elements.deadlineInput.value = todo.deadline || "";
  elements.priorityInput.value = todo.priority ?? "3";
  const submitBtn = elements.todoForm.querySelector("button[type='submit']");
  submitBtn.textContent = "수정 저장";
}

function handleSubmit(e) {
  e.preventDefault();
  if (!isUnlocked) return;

  const title = elements.titleInput.value.trim();
  const deadline = elements.deadlineInput.value;
  const priority = elements.priorityInput.value || "3";

  if (!title) {
    alert("할 일 제목을 입력해 주세요.");
    return;
  }

  if (!deadline) {
    alert("마감일을 선택해 주세요.");
    return;
  }

  if (editingId != null) {
    const todo = todos.find((t) => t.id === editingId);
    if (todo) {
      todo.title = title;
      todo.deadline = deadline;
      todo.priority = Number(priority);
    }
  } else {
    const newId = todos.length === 0 ? 1 : Math.max(...todos.map((t) => t.id || 0)) + 1;
    todos.push({
      id: newId,
      title,
      deadline,
      priority: Number(priority),
      done: false,
    });
  }

  saveToLocalStorage();
  resetForm();
  renderTodos();
}

function handleUnlock() {
  const value = elements.passwordInput.value;
  if (!value) {
    alert("비밀번호를 입력해 주세요.");
    return;
  }
  if (value === EDIT_PASSWORD) {
    isUnlocked = true;
    try {
      localStorage.setItem(UNLOCK_KEY, "true");
    } catch (e) {
      console.warn("unlock 상태 저장 실패", e);
    }
    updateLockUI();
  } else {
    alert("비밀번호가 올바르지 않습니다.");
  }
}

function handleLock() {
  isUnlocked = false;
  try {
    localStorage.removeItem(UNLOCK_KEY);
  } catch (e) {
    console.warn("unlock 상태 제거 실패", e);
  }
  updateLockUI();
}

function initLockState() {
  try {
    const stored = localStorage.getItem(UNLOCK_KEY);
    isUnlocked = stored === "true";
  } catch (e) {
    isUnlocked = false;
  }
  updateLockUI();
}

function handleExportJson() {
  const dataStr = JSON.stringify(todos, null, 2);
  const blob = new Blob([dataStr], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "todos.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  alert("다운로드된 todos.json 내용을 리포지토리의 data/todos.json 에 덮어쓴 뒤 커밋/푸시하면 됩니다.");
}

async function init() {
  initLockState();
  loadFromLocalStorage();
  if (todos.length === 0) {
    await loadFromFile();
  }
  renderTodos();

  elements.todoForm.addEventListener("submit", handleSubmit);
  elements.resetFormBtn.addEventListener("click", (e) => {
    e.preventDefault();
    if (!isUnlocked) return;
    resetForm();
  });
  elements.unlockBtn.addEventListener("click", handleUnlock);
  elements.lockBtn.addEventListener("click", handleLock);
  elements.filterSelect.addEventListener("change", renderTodos);
  elements.exportJsonBtn.addEventListener("click", handleExportJson);
}

document.addEventListener("DOMContentLoaded", init);

