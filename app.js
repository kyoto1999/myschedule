// 간단한 비밀번호 (개인용이므로 코드 안에 두는 방식)
const EDIT_PASSWORD = "myschedule123"; // 원하면 나중에 바꿔 쓰세요.
const STORAGE_KEY = "myschedule_todos_v1";
const UNLOCK_KEY = "myschedule_unlocked_v1";
const DEPARTMENT_LIST = ["개인", "전략기획단", "정책센터", "대외협력실", "기본사업", "대한설비공학회"];

let todos = [];
let isUnlocked = false;
let currentCalendarYear;
let currentCalendarMonth;

const elements = {
  passwordInput: document.getElementById("password-input"),
  unlockBtn: document.getElementById("unlock-btn"),
  lockBtn: document.getElementById("lock-btn"),
  lockStatus: document.getElementById("lock-status"),

  todoForm: document.getElementById("todo-form"),
  titleInput: document.getElementById("title-input"),
  departmentSelect: document.getElementById("department-select"),
  deadlineInput: document.getElementById("deadline-input"),
  resetFormBtn: document.getElementById("reset-form-btn"),

  filterSelect: document.getElementById("filter-select"),
  todoListEmpty: document.getElementById("todo-list-empty"),
  departmentList: document.getElementById("department-list"),
  departmentSection: document.querySelector(".department-section"),
  completedSection: document.getElementById("completed-section"),
  completedList: document.getElementById("completed-list"),
  completedListEmpty: document.getElementById("completed-list-empty"),
  priorityTitlesList: document.getElementById("priority-titles-list"),
  priorityDateInput: document.getElementById("priority-date-input"),
  exportJsonBtn: document.getElementById("export-json-btn"),
  resetStorageBtn: document.getElementById("reset-storage-btn"),
  calendarSection: document.getElementById("calendar-section"),
  calendarMonthLabel: document.getElementById("calendar-month-label"),
  calendarGrid: document.getElementById("calendar-grid"),
  calendarPrevBtn: document.getElementById("calendar-prev-btn"),
  calendarNextBtn: document.getElementById("calendar-next-btn"),
  deadlineCalendarBtn: document.getElementById("deadline-calendar-btn"),
  datepickerPopup: document.getElementById("datepicker-popup"),
  milestonesContainer: document.getElementById("milestones-container"),
  addMilestoneBtn: document.getElementById("add-milestone-btn"),
};

let editingId = null;
let datepickerYear;
let datepickerMonth;
let datepickerOnSelect = null;
let datepickerSelectedValue = "";
let datepickerExcludeEls = [];

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

function sortTodosWithParentFirst(list) {
  const sorted = [...list].sort(compareTodos);
  const result = [];
  const added = new Set();
  const addWithChildren = (todo) => {
    if (added.has(todo.id)) return;
    added.add(todo.id);
    result.push(todo);
    getChildTodos(todo).sort(compareTodos).forEach(addWithChildren);
  };
  sorted.forEach((t) => {
    if (!t.parentId) addWithChildren(t);
  });
  sorted.forEach((t) => {
    if (t.parentId && !added.has(t.id)) addWithChildren(t);
  });
  return result;
}

function compareByPriority(a, b) {
  const pa = Number(a.priority) || 999;
  const pb = Number(b.priority) || 999;
  if (pa !== pb) return pa - pb;
  const dateA = safeParseDate(a.deadline);
  const dateB = safeParseDate(b.deadline);
  if (!dateA && dateB) return 1;
  if (dateA && !dateB) return -1;
  if (dateA && dateB) {
    const diff = dateA - dateB;
    if (diff !== 0) return diff;
  }
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

function formatYmd(year, monthIndex, day) {
  const mm = String(monthIndex + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function parseYmd(value) {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return null;
  const y = parseInt(match[1], 10);
  const m = parseInt(match[2], 10) - 1;
  const d = parseInt(match[3], 10);
  if (m < 0 || m > 11 || d < 1 || d > 31) return null;
  const date = new Date(y, m, d);
  if (date.getFullYear() !== y || date.getMonth() !== m || date.getDate() !== d) return null;
  return date;
}

function openDatepicker() {
  openDatepickerFor(
    [elements.deadlineInput, elements.deadlineCalendarBtn].filter(Boolean),
    elements.deadlineInput?.value?.trim() || "",
    (dateStr) => {
      if (elements.deadlineInput) elements.deadlineInput.value = dateStr;
    }
  );
}

function openDatepickerFor(triggerOrExcludes, currentValue, onSelect) {
  const exclList = Array.isArray(triggerOrExcludes) ? triggerOrExcludes : [triggerOrExcludes];
  const triggerEl = exclList[0];
  const parsed = parseYmd(currentValue);
  const today = new Date();
  if (parsed) {
    datepickerYear = parsed.getFullYear();
    datepickerMonth = parsed.getMonth();
  } else {
    datepickerYear = today.getFullYear();
    datepickerMonth = today.getMonth();
  }
  datepickerOnSelect = onSelect;
  datepickerSelectedValue = currentValue;
  datepickerExcludeEls = exclList;
  renderDatepicker();
  if (elements.datepickerPopup) {
    if (triggerEl && document.body.contains(triggerEl)) {
      document.body.appendChild(elements.datepickerPopup);
      const rect = triggerEl.getBoundingClientRect();
      elements.datepickerPopup.style.position = "fixed";
      elements.datepickerPopup.style.left = `${Math.min(rect.left, window.innerWidth - 260)}px`;
      elements.datepickerPopup.style.top = `${rect.bottom + 4}px`;
    }
    elements.datepickerPopup.classList.add("is-open");
    elements.datepickerPopup.setAttribute("aria-hidden", "false");
  }
}

function closeDatepicker() {
  datepickerOnSelect = null;
  datepickerSelectedValue = "";
  datepickerExcludeEls = [];
  if (elements.datepickerPopup) {
    elements.datepickerPopup.classList.remove("is-open");
    elements.datepickerPopup.setAttribute("aria-hidden", "true");
  }
}

function renderDatepicker() {
  if (!elements.datepickerPopup) return;
  const year = datepickerYear;
  const month = datepickerMonth;
  const firstDay = new Date(year, month, 1);
  const firstWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const todayStr = getTodayString();
  const selectedStr = datepickerOnSelect ? datepickerSelectedValue.trim() : (elements.deadlineInput?.value?.trim() || "");
  const selectedValid = parseYmd(selectedStr);

  let html = "";
  html += '<div class="datepicker-header">';
  html += '<span class="datepicker-title">' + year + "년 " + (month + 1) + "월</span>";
  html += '<div class="datepicker-nav">';
  html += '<button type="button" class="secondary datepicker-prev">◀</button>';
  html += '<button type="button" class="secondary datepicker-next">▶</button>';
  html += "</div></div>";
  html += '<div class="datepicker-weekdays"><span>일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span></div>';
  html += '<div class="datepicker-grid">';

  for (let i = 0; i < 42; i += 1) {
    let cellYear = year;
    let cellMonth = month;
    let day;
    let isOther = false;
    if (i < firstWeekday) {
      isOther = true;
      cellMonth = month - 1;
      if (cellMonth < 0) {
        cellMonth = 11;
        cellYear = year - 1;
      }
      day = daysInPrevMonth - (firstWeekday - 1 - i);
    } else if (i >= firstWeekday + daysInMonth) {
      isOther = true;
      day = i - (firstWeekday + daysInMonth) + 1;
      cellMonth = month + 1;
      if (cellMonth > 11) {
        cellMonth = 0;
        cellYear = year + 1;
      }
    } else {
      day = i - firstWeekday + 1;
    }
    const dateStr = formatYmd(cellYear, cellMonth, day);
    const isToday = dateStr === todayStr;
    const isSelected = selectedValid && formatYmd(selectedValid.getFullYear(), selectedValid.getMonth(), selectedValid.getDate()) === dateStr;
    let cls = "datepicker-day";
    if (isOther) cls += " other-month";
    if (isToday) cls += " today";
    if (isSelected) cls += " selected";
    html += '<button type="button" class="' + cls + '" data-date="' + dateStr + '">' + day + "</button>";
  }
  html += "</div>";
  elements.datepickerPopup.innerHTML = html;

  elements.datepickerPopup.querySelectorAll(".datepicker-day").forEach((btn) => {
    btn.addEventListener("click", () => {
      const dateStr = btn.getAttribute("data-date");
      if (dateStr) {
        if (datepickerOnSelect) {
          datepickerOnSelect(dateStr);
        } else if (elements.deadlineInput) {
          elements.deadlineInput.value = dateStr;
        }
        closeDatepicker();
      }
    });
  });
  const prevBtn = elements.datepickerPopup.querySelector(".datepicker-prev");
  const nextBtn = elements.datepickerPopup.querySelector(".datepicker-next");
  if (prevBtn) {
    prevBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (datepickerMonth === 0) {
        datepickerMonth = 11;
        datepickerYear -= 1;
      } else {
        datepickerMonth -= 1;
      }
      renderDatepicker();
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (datepickerMonth === 11) {
        datepickerMonth = 0;
        datepickerYear += 1;
      } else {
        datepickerMonth += 1;
      }
      renderDatepicker();
    });
  }
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
      if (migrateMilestonesToChildTodos()) {
        saveToLocalStorage();
      }
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
  if (elements.departmentSelect) elements.departmentSelect.disabled = disabled;
  elements.deadlineInput.disabled = disabled;
  elements.resetFormBtn.disabled = disabled;
  elements.todoForm.querySelector("button[type='submit']").disabled = disabled;
  if (elements.addMilestoneBtn) elements.addMilestoneBtn.disabled = disabled;
  elements.milestonesContainer?.querySelectorAll("input, button").forEach((el) => {
    el.disabled = disabled;
  });

  const actionButtons = document.querySelectorAll(".todo-actions button");
  actionButtons.forEach((btn) => {
    btn.disabled = disabled;
  });

  document.querySelectorAll(".todo-inprogress-checkbox").forEach((cb) => {
    cb.disabled = disabled;
  });

   if (elements.resetStorageBtn) {
     elements.resetStorageBtn.disabled = disabled;
   }
}

function getTodoDepartment(todo) {
  const d = todo.department;
  return DEPARTMENT_LIST.includes(d) ? d : DEPARTMENT_LIST[0];
}

function getParentTodo(todo) {
  if (!todo || !todo.parentId) return null;
  return todos.find((t) => t.id === todo.parentId) || null;
}

function getChildTodos(todo) {
  if (!todo || !todo.id) return [];
  return todos.filter((t) => t.parentId === todo.id);
}

function getMilestones(todo) {
  return todo && Array.isArray(todo.milestones) ? todo.milestones : [];
}

function migrateMilestonesToChildTodos() {
  const toAdd = [];
  let changed = false;
  const maxId = todos.length === 0 ? 0 : Math.max(...todos.map((t) => t.id || 0));
  let nextId = maxId + 1;
  todos.forEach((todo) => {
    const ms = getMilestones(todo);
    if (ms.length === 0) return;
    const dept = getTodoDepartment(todo);
    const prio = Number(todo.priority) || 3;
    ms.forEach((m) => {
      if (!m.date || !/^\d{4}-\d{2}-\d{2}$/.test(m.date)) return;
      toAdd.push({
        id: nextId++,
        title: m.label || `${todo.title} - 마일스톤`,
        deadline: m.date,
        department: dept,
        priority: prio,
        done: false,
        parentId: todo.id,
      });
    });
    delete todo.milestones;
    changed = true;
  });
  toAdd.forEach((c) => todos.push(c));
  return changed;
}

function createMilestoneRow(milestone = { date: "", label: "" }) {
  const row = document.createElement("div");
  row.className = "milestone-row";
  const dateInput = document.createElement("input");
  dateInput.type = "date";
  dateInput.className = "milestone-date";
  dateInput.value = milestone.date || "";
  const labelInput = document.createElement("input");
  labelInput.type = "text";
  labelInput.className = "milestone-label";
  labelInput.placeholder = "예: 1차 작업";
  labelInput.value = milestone.label || "";
  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "secondary milestone-remove-btn";
  removeBtn.textContent = "삭제";
  removeBtn.addEventListener("click", () => {
    row.remove();
  });
  row.appendChild(dateInput);
  row.appendChild(labelInput);
  row.appendChild(removeBtn);
  return row;
}

function renderMilestoneRows(milestones) {
  if (!elements.milestonesContainer) return;
  elements.milestonesContainer.innerHTML = "";
  (milestones || []).forEach((m) => {
    elements.milestonesContainer.appendChild(createMilestoneRow(m));
  });
}

function collectMilestonesFromForm() {
  if (!elements.milestonesContainer) return [];
  return collectMilestonesFromContainer(elements.milestonesContainer);
}

function collectMilestonesFromContainer(container) {
  if (!container) return [];
  const rows = container.querySelectorAll(".milestone-row");
  const result = [];
  rows.forEach((row) => {
    const dateInput = row.querySelector(".milestone-date");
    const labelInput = row.querySelector(".milestone-label");
    const date = dateInput?.value?.trim();
    const label = (labelInput?.value ?? "").trim();
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      result.push({ date, label });
    }
  });
  return result;
}

function openTodoMilestonePopover(todo, triggerEl) {
  const existing = document.querySelector(".todo-milestone-popover");
  if (existing) existing.remove();

  const popover = document.createElement("div");
  popover.className = "todo-milestone-popover";

  const container = document.createElement("div");
  container.className = "milestone-popover-list";
  getChildTodos(todo).forEach((child) => {
    container.appendChild(createMilestoneRow({ date: child.deadline || "", label: child.title || "" }));
  });

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "secondary";
  addBtn.textContent = "마일스톤 추가";
  addBtn.addEventListener("click", () => {
    container.appendChild(createMilestoneRow({ date: "", label: "" }));
  });

  const applyBtn = document.createElement("button");
  applyBtn.type = "button";
  applyBtn.textContent = "적용";
  applyBtn.addEventListener("click", () => {
    const rows = collectMilestonesFromContainer(container);
    const children = getChildTodos(todo);
    rows.forEach((row, i) => {
      if (children[i]) {
        children[i].deadline = row.date;
        children[i].title = row.label || `${todo.title} - 마일스톤`;
      } else {
        const newId = todos.length === 0 ? 1 : Math.max(...todos.map((t) => t.id || 0)) + 1;
        todos.push({
          id: newId,
          title: row.label || `${todo.title} - 마일스톤`,
          deadline: row.date,
          department: getTodoDepartment(todo),
          priority: Number(todo.priority) || 3,
          done: false,
          parentId: todo.id,
        });
      }
    });
    if (children.length > rows.length) {
      children.slice(rows.length).forEach((c) => {
        todos = todos.filter((t) => t.id !== c.id);
      });
    }
    saveToLocalStorage();
    document.removeEventListener("click", closeOnOutside);
    popover.remove();
    renderTodos();
  });

  const actions = document.createElement("div");
  actions.className = "milestone-popover-actions";
  actions.appendChild(addBtn);
  actions.appendChild(applyBtn);
  popover.appendChild(container);
  popover.appendChild(actions);

  document.body.appendChild(popover);
  const rect = triggerEl.getBoundingClientRect();
  popover.style.position = "fixed";
  popover.style.left = `${Math.min(rect.left, window.innerWidth - 280)}px`;
  popover.style.top = `${rect.bottom + 4}px`;

  const closeOnOutside = (e) => {
    if (!popover.contains(e.target) && !triggerEl.contains(e.target)) {
      const rows = collectMilestonesFromContainer(container);
      const children = getChildTodos(todo);
      rows.forEach((row, i) => {
        if (children[i]) {
          children[i].deadline = row.date;
          children[i].title = row.label || `${todo.title} - 마일스톤`;
        } else {
          const newId = todos.length === 0 ? 1 : Math.max(...todos.map((t) => t.id || 0)) + 1;
          todos.push({
            id: newId,
            title: row.label || `${todo.title} - 마일스톤`,
            deadline: row.date,
            department: getTodoDepartment(todo),
            priority: Number(todo.priority) || 3,
            done: false,
            parentId: todo.id,
          });
        }
      });
      if (children.length > rows.length) {
        children.slice(rows.length).forEach((c) => {
          todos = todos.filter((t) => t.id !== c.id);
        });
      }
      saveToLocalStorage();
      popover.remove();
      renderTodos();
      document.removeEventListener("click", closeOnOutside);
    }
  };
  setTimeout(() => document.addEventListener("click", closeOnOutside), 0);
}

function createTodoItem(todo) {
  const item = document.createElement("div");
  item.className = "todo-item";
  if (todo.parentId) item.classList.add("todo-item--milestone");

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
  checkbox.title = "완료";
  checkbox.addEventListener("change", () => {
    todo.done = checkbox.checked;
    saveToLocalStorage();
    renderTodos();
  });

  const inProgressWrap = document.createElement("label");
  inProgressWrap.className = "todo-inprogress-wrap";
  inProgressWrap.title = "시작했으면 체크 (진행 중인 작업)";
  const inProgressCheck = document.createElement("input");
  inProgressCheck.type = "checkbox";
  inProgressCheck.className = "todo-inprogress-checkbox";
  inProgressCheck.checked = !!todo.inProgress;
  inProgressCheck.addEventListener("change", () => {
    todo.inProgress = inProgressCheck.checked;
    saveToLocalStorage();
    renderTodos();
  });
  const inProgressLabel = document.createElement("span");
  inProgressLabel.className = "todo-inprogress-label";
  inProgressLabel.textContent = "시작";
  inProgressWrap.appendChild(inProgressCheck);
  inProgressWrap.appendChild(inProgressLabel);

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

  const badgeDeadline = document.createElement("span");
  badgeDeadline.className = "badge badge-deadline";
  if (isUnlocked) {
    const deadlineLabel = document.createElement("span");
    deadlineLabel.textContent = "마감일: ";
    const wrap = document.createElement("div");
    wrap.className = "deadline-picker-wrap";
    const deadlineInput = document.createElement("input");
    deadlineInput.type = "date";
    deadlineInput.className = "todo-deadline-input";
    deadlineInput.value = todo.deadline || "";
    deadlineInput.title = "마감일 수정";
    deadlineInput.addEventListener("change", () => {
      todo.deadline = deadlineInput.value || null;
      saveToLocalStorage();
      renderTodos();
    });
    const calBtn = document.createElement("button");
    calBtn.type = "button";
    calBtn.className = "calendar-trigger-btn";
    calBtn.title = "달력에서 선택";
    calBtn.textContent = "📅";
    calBtn.addEventListener("click", (e) => {
      e.preventDefault();
      openDatepickerFor([calBtn, deadlineInput], todo.deadline || "", (dateStr) => {
        todo.deadline = dateStr;
        deadlineInput.value = dateStr;
        saveToLocalStorage();
        renderTodos();
      });
    });
    wrap.appendChild(deadlineInput);
    wrap.appendChild(calBtn);
    badgeDeadline.appendChild(deadlineLabel);
    badgeDeadline.appendChild(wrap);
  } else {
    badgeDeadline.textContent = todo.deadline ? `마감일: ${todo.deadline}` : "마감일: -";
  }
  meta.appendChild(badgeDeadline);

  const parentTodo = getParentTodo(todo);
  if (parentTodo) {
    const parentBadge = document.createElement("span");
    parentBadge.className = "badge badge-parent";
    parentBadge.textContent = `상위: ${parentTodo.title || "(제목 없음)"}`;
    parentBadge.title = `상위 할 일: ${parentTodo.title || ""}`;
    meta.appendChild(parentBadge);
  }

  const childList = getChildTodos(todo);
  const msWrap = document.createElement("span");
  msWrap.className = "badge badge-milestone-trigger";
  if (isUnlocked && !todo.parentId) {
    const msBtn = document.createElement("button");
    msBtn.type = "button";
    msBtn.className = "milestone-add-btn";
    msBtn.textContent = childList.length > 0 ? `마일스톤(${childList.length})` : "마일스톤 추가";
    msBtn.title = "마일스톤 추가/편집";
    msBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openTodoMilestonePopover(todo, msBtn);
    });
    msWrap.appendChild(msBtn);
  } else if (!todo.parentId && childList.length > 0) {
    const parts = childList.map((c) => {
      const d = (c.deadline || "").replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$2/$3");
      return c.title ? `${d} ${c.title}` : d;
    });
    msWrap.textContent = `마일스톤: ${parts.join(", ")}`;
    msWrap.title = childList.map((c) => `${c.deadline} ${c.title || ""}`.trim()).join("\n");
    msWrap.classList.add("badge-milestones");
  } else if (!todo.parentId) {
    msWrap.textContent = "마일스톤";
    msWrap.classList.add("badge-milestones-empty");
  }
  if (!todo.parentId) meta.appendChild(msWrap);

  const prioContainer = document.createElement("span");
  prioContainer.className = "badge badge-priority";
  const prioNum = Number(todo.priority) || 3;
  if (prioNum === 1 || prioNum === 2) {
    prioContainer.classList.add("badge-priority-high");
  }

  if (isUnlocked) {
    const select = document.createElement("select");
    select.style.background = "transparent";
    select.style.border = "none";
    select.style.color = "inherit";
    select.style.fontSize = "0.78rem";

    for (let v = 1; v <= 5; v += 1) {
      const opt = document.createElement("option");
      opt.value = String(v);
      opt.textContent = `우선순위 ${v}`;
      if (v === prioNum) opt.selected = true;
      select.appendChild(opt);
    }

    select.addEventListener("change", () => {
      todo.priority = Number(select.value);
      saveToLocalStorage();
      todos.sort(compareTodos);
      renderTodos();
    });

    prioContainer.textContent = "";
    prioContainer.appendChild(select);
  } else {
    prioContainer.textContent = `우선순위: ${todo.priority ?? "-"}`;
  }

  meta.appendChild(prioContainer);

  const deptMoveContainer = document.createElement("span");
  deptMoveContainer.className = "badge badge-dept-move";
  const currentDept = getTodoDepartment(todo);
  if (isUnlocked) {
    const deptSelect = document.createElement("select");
    deptSelect.className = "department-move-select";
    deptSelect.title = "요청 부서로 이동";
    DEPARTMENT_LIST.forEach((d) => {
      const opt = document.createElement("option");
      opt.value = d;
      opt.textContent = d;
      if (d === currentDept) opt.selected = true;
      deptSelect.appendChild(opt);
    });
    deptSelect.addEventListener("change", () => {
      todo.department = deptSelect.value;
      saveToLocalStorage();
      renderTodos();
    });
    deptMoveContainer.appendChild(deptSelect);
  } else {
    deptMoveContainer.textContent = `부서: ${currentDept}`;
  }
  meta.appendChild(deptMoveContainer);

  const statusBadge = document.createElement("span");
  statusBadge.className = "badge badge-status-pending";
  if (todo.done) {
    statusBadge.classList.add("badge-status-done");
    statusBadge.textContent = "완료";
  } else if (todo.inProgress) {
    statusBadge.classList.add("badge-status-progress");
    statusBadge.textContent = "진행";
  } else if (isOverdue(todo.deadline)) {
    statusBadge.textContent = "지남";
  } else if (isDueSoon(todo.deadline)) {
    statusBadge.textContent = "임박";
  } else {
    statusBadge.textContent = "대기";
  }
  meta.appendChild(statusBadge);

  content.appendChild(title);
  content.appendChild(meta);

  main.appendChild(checkbox);
  main.appendChild(inProgressWrap);
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
    const toRemove = new Set([todo.id, ...getChildTodos(todo).map((c) => c.id)]);
    todos = todos.filter((t) => !toRemove.has(t.id));
    saveToLocalStorage();
    renderTodos();
  });

  actions.appendChild(editBtn);
  actions.appendChild(deleteBtn);

  item.appendChild(main);
  item.appendChild(actions);

  return item;
}

function renderTodos() {
  if (!elements.departmentList) return;

  const filter = elements.filterSelect.value;
  const todayStr = getTodayString();

  const applyFilter = (list) => {
    return list.filter((todo) => {
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
  };

  elements.departmentList.innerHTML = "";

  let totalFiltered = 0;

  DEPARTMENT_LIST.forEach((dept) => {
    const deptTodos = todos.filter((t) => getTodoDepartment(t) === dept && !t.done);
    const filtered = applyFilter(sortTodosWithParentFirst(deptTodos));

    const block = document.createElement("div");
    block.className = "department-block";

    const heading = document.createElement("h3");
    heading.className = "department-heading";
    heading.textContent = dept;

    const list = document.createElement("div");
    list.className = "todo-list";

    filtered.forEach((todo) => {
      list.appendChild(createTodoItem(todo));
      totalFiltered += 1;
    });

    block.appendChild(heading);
    block.appendChild(list);
    elements.departmentList.appendChild(block);
  });

  if (totalFiltered === 0) {
    elements.todoListEmpty.style.display = "block";
  } else {
    elements.todoListEmpty.style.display = "none";
  }

  const completedTodos = sortTodosWithParentFirst(todos.filter((t) => t.done));
  if (elements.completedSection) {
    elements.completedSection.style.display = filter === "pending" ? "none" : "";
  }
  if (elements.departmentSection) {
    elements.departmentSection.style.display = filter === "done" ? "none" : "";
  }
  if (elements.completedList) {
    elements.completedList.innerHTML = "";
    if (filter !== "pending") {
      elements.completedList.style.display = "flex";
      if (completedTodos.length === 0) {
        if (elements.completedListEmpty) {
          elements.completedListEmpty.style.display = "block";
        }
      } else {
        if (elements.completedListEmpty) elements.completedListEmpty.style.display = "none";
        completedTodos.forEach((todo) => {
          elements.completedList.appendChild(createTodoItem(todo));
        });
      }
    }
  }

  renderPriorityTitles(filter, todayStr);
  updateLockUI();
  renderCalendar();
}

function renderPriorityTitles(filter, todayStr) {
  if (!elements.priorityTitlesList) return;
  const selectedDate = elements.priorityDateInput?.value?.trim();
  const applyFilter = (list) =>
    list.filter((todo) => {
      if (selectedDate) return todo.deadline === selectedDate;
      if (filter === "today") return todo.deadline === todayStr && !todo.done;
      if (filter === "pending") return !todo.done;
      if (filter === "done") return !!todo.done;
      return true;
    });
  const filtered = applyFilter([...todos].sort(compareByPriority));
  elements.priorityTitlesList.innerHTML = "";
  if (filtered.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-message";
    empty.textContent = "표시할 할 일이 없습니다.";
    elements.priorityTitlesList.appendChild(empty);
    return;
  }
  filtered.forEach((todo) => {
    const row = document.createElement("div");
    row.className = "priority-title-row";
    const prioCell = document.createElement("div");
    prioCell.className = "priority-title-prio-cell";
    if (isUnlocked) {
      const prioSelect = document.createElement("select");
      prioSelect.className = "priority-title-prio-select";
      prioSelect.title = "우선순위 변경";
      for (let v = 1; v <= 5; v += 1) {
        const opt = document.createElement("option");
        opt.value = String(v);
        opt.textContent = String(v);
        if (v === (todo.priority ?? 3)) opt.selected = true;
        prioSelect.appendChild(opt);
      }
      prioSelect.addEventListener("change", () => {
        todo.priority = Number(prioSelect.value);
        saveToLocalStorage();
        todos.sort(compareTodos);
        renderTodos();
      });
      prioCell.appendChild(prioSelect);
    } else {
      const prio = document.createElement("span");
      prio.className = "priority-title-prio";
      prio.textContent = `P${todo.priority ?? "-"}`;
      prioCell.appendChild(prio);
    }
    const title = document.createElement("span");
    title.className = "priority-title-text";
    title.textContent = todo.title || "(제목 없음)";
    if (todo.done) title.classList.add("done");
    row.appendChild(prioCell);
    row.appendChild(title);
    elements.priorityTitlesList.appendChild(row);
  });
}

function renderCalendar() {
  if (!elements.calendarGrid || !elements.calendarMonthLabel) return;

  if (typeof currentCalendarYear !== "number" || typeof currentCalendarMonth !== "number") {
    const today = new Date();
    currentCalendarYear = today.getFullYear();
    currentCalendarMonth = today.getMonth();
  }

  const year = currentCalendarYear;
  const month = currentCalendarMonth;

  elements.calendarMonthLabel.textContent = `${year}년 ${month + 1}월`;

  const firstDay = new Date(year, month, 1);
  const firstWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  elements.calendarGrid.innerHTML = "";
  const todayStr = getTodayString();

  for (let i = 0; i < 42; i += 1) {
    const cell = document.createElement("div");
    cell.className = "calendar-cell";

    let displayDay;
    let cellYear = year;
    let cellMonth = month;
    let inCurrentMonth = true;

    if (i < firstWeekday) {
      inCurrentMonth = false;
      displayDay = daysInPrevMonth - (firstWeekday - 1 - i);
      if (month === 0) {
        cellYear = year - 1;
        cellMonth = 11;
      } else {
        cellMonth = month - 1;
      }
    } else if (i >= firstWeekday + daysInMonth) {
      inCurrentMonth = false;
      displayDay = i - (firstWeekday + daysInMonth) + 1;
      if (month === 11) {
        cellYear = year + 1;
        cellMonth = 0;
      } else {
        cellMonth = month + 1;
      }
    } else {
      displayDay = i - firstWeekday + 1;
    }

    const dateStr = formatYmd(cellYear, cellMonth, displayDay);

    if (!inCurrentMonth) {
      cell.classList.add("calendar-cell--other-month");
    }
    if (dateStr === todayStr) {
      cell.classList.add("calendar-cell--today");
    }

    const dateLabel = document.createElement("div");
    dateLabel.className = "calendar-date-label";
    dateLabel.textContent = displayDay;

    const todosContainer = document.createElement("div");
    todosContainer.className = "calendar-todos";

    const dayTodos = [];
    todos.forEach((t) => {
      if (t.deadline === dateStr) {
        const type = t.parentId ? "milestone" : "deadline";
        dayTodos.push({ todo: t, type });
      }
    });
    dayTodos.sort((a, b) => compareTodos(a.todo, b.todo));
    if (dayTodos.length > 0) {
      cell.classList.add("calendar-cell--has-todo");
    }

    dayTodos.forEach(({ todo, type }) => {
      const pill = document.createElement("div");
      pill.className = "calendar-todo-pill";
      if (todo.done) pill.classList.add("calendar-todo-pill--done");
      if (type === "milestone") pill.classList.add("calendar-todo-pill--milestone");
      const fullTitle = todo.title || "";
      const maxLen = 10;
      const shortTitle = fullTitle.length > maxLen ? `${fullTitle.slice(0, maxLen)}…` : fullTitle;
      const prefix = type === "milestone" ? "M " : `P${todo.priority ?? "-"} `;
      pill.textContent = prefix + shortTitle;
      pill.title = type === "milestone" ? `마일스톤: ${fullTitle}` : fullTitle;
      todosContainer.appendChild(pill);
    });

    cell.appendChild(dateLabel);
    cell.appendChild(todosContainer);
    elements.calendarGrid.appendChild(cell);
  }
}

function resetForm() {
  editingId = null;
  elements.todoForm.reset();
  if (elements.departmentSelect) {
    elements.departmentSelect.value = "";
  }
  renderMilestoneRows([]);
  const submitBtn = elements.todoForm.querySelector("button[type='submit']");
  submitBtn.textContent = "추가";
}

function startEdit(id) {
  const todo = todos.find((t) => t.id === id);
  if (!todo) return;
  editingId = id;
  elements.titleInput.value = todo.title || "";
  elements.deadlineInput.value = todo.deadline || "";
  if (elements.departmentSelect) {
    const dept = getTodoDepartment(todo);
    elements.departmentSelect.value = dept;
  }
  if (!todo.parentId) {
    renderMilestoneRows(
      getChildTodos(todo).map((c) => ({ date: c.deadline || "", label: c.title || "" }))
    );
  } else {
    renderMilestoneRows([]);
  }
  const submitBtn = elements.todoForm.querySelector("button[type='submit']");
  submitBtn.textContent = "수정 저장";
}

function handleSubmit(e) {
  e.preventDefault();
  if (!isUnlocked) return;

  const title = elements.titleInput.value.trim();
  const department = elements.departmentSelect?.value?.trim() || "";
  const deadline = elements.deadlineInput.value;
  const defaultPriority = 3;

  if (!title) {
    alert("할 일 제목을 입력해 주세요.");
    return;
  }

  if (!department || !DEPARTMENT_LIST.includes(department)) {
    alert("요청 부서를 선택해 주세요.");
    return;
  }

  const deadlineParsed = parseYmd(deadline);
  if (!deadline || !deadlineParsed) {
    alert("마감일을 YYYY-MM-DD 형식으로 입력하거나 달력에서 선택해 주세요.");
    return;
  }
  const deadlineStr = formatYmd(deadlineParsed.getFullYear(), deadlineParsed.getMonth(), deadlineParsed.getDate());
  const milestoneRows = collectMilestonesFromForm();

  if (editingId != null) {
    const todo = todos.find((t) => t.id === editingId);
    if (todo) {
      todo.title = title;
      todo.deadline = deadlineStr;
      todo.department = department;
      if (!Number.isFinite(Number(todo.priority))) {
        todo.priority = defaultPriority;
      }
      const children = getChildTodos(todo);
      milestoneRows.forEach((row, i) => {
        if (children[i]) {
          children[i].deadline = row.date;
          children[i].title = row.label || `${todo.title} - 마일스톤`;
        } else {
          const newId = todos.length === 0 ? 1 : Math.max(...todos.map((t) => t.id || 0)) + 1;
          todos.push({
            id: newId,
            title: row.label || `${todo.title} - 마일스톤`,
            deadline: row.date,
            department,
            priority: Number(todo.priority) || defaultPriority,
            done: false,
            parentId: todo.id,
          });
        }
      });
      if (children.length > milestoneRows.length) {
        children.slice(milestoneRows.length).forEach((c) => {
          todos = todos.filter((t) => t.id !== c.id);
        });
      }
    }
  } else {
    const newId = todos.length === 0 ? 1 : Math.max(...todos.map((t) => t.id || 0)) + 1;
    todos.push({
      id: newId,
      title,
      deadline: deadlineStr,
      department,
      priority: defaultPriority,
      done: false,
    });
    milestoneRows.forEach((row) => {
      const childId = Math.max(...todos.map((t) => t.id || 0)) + 1;
      todos.push({
        id: childId,
        title: row.label || `${title} - 마일스톤`,
        deadline: row.date,
        department,
        priority: defaultPriority,
        done: false,
        parentId: newId,
      });
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

function handleResetStorage() {
  if (!isUnlocked) return;
  const ok = confirm(
    "이 브라우저에 저장된 일정 데이터(localStorage)와 잠금 상태를 모두 초기화합니다.\nGitHub에 있는 data/todos.json 파일은 그대로 유지됩니다.\n계속하시겠습니까?"
  );
  if (!ok) return;

  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(UNLOCK_KEY);
  } catch (e) {
    console.warn("localStorage 초기화 실패", e);
  }

  alert("브라우저 저장 데이터가 초기화되었습니다.\n페이지를 다시 불러와 GitHub의 data/todos.json 기준으로 새로 표시합니다.");
  window.location.reload();
}

async function init() {
  initLockState();
  const today = new Date();
  currentCalendarYear = today.getFullYear();
  currentCalendarMonth = today.getMonth();
  datepickerYear = today.getFullYear();
  datepickerMonth = today.getMonth();

  loadFromLocalStorage();
  if (todos.length === 0) {
    await loadFromFile();
  }
  if (elements.priorityDateInput) {
    elements.priorityDateInput.value = getTodayString();
  }
  renderTodos();

  elements.todoForm.addEventListener("submit", handleSubmit);
  elements.resetFormBtn.addEventListener("click", (e) => {
    e.preventDefault();
    if (!isUnlocked) return;
    resetForm();
  });
  if (elements.addMilestoneBtn) {
    elements.addMilestoneBtn.addEventListener("click", (e) => {
      e.preventDefault();
      if (!isUnlocked) return;
      if (elements.milestonesContainer) {
        elements.milestonesContainer.appendChild(createMilestoneRow({ date: "", label: "" }));
      }
    });
  }
  elements.unlockBtn.addEventListener("click", handleUnlock);
  elements.lockBtn.addEventListener("click", handleLock);
  elements.filterSelect.addEventListener("change", renderTodos);
  if (elements.priorityDateInput) {
    elements.priorityDateInput.addEventListener("change", renderTodos);
  }
  elements.exportJsonBtn.addEventListener("click", handleExportJson);
  if (elements.resetStorageBtn) {
    elements.resetStorageBtn.addEventListener("click", handleResetStorage);
  }
  if (elements.deadlineInput) {
    elements.deadlineInput.addEventListener("focus", openDatepicker);
    elements.deadlineInput.addEventListener("click", openDatepicker);
  }
  if (elements.deadlineCalendarBtn) {
    elements.deadlineCalendarBtn.addEventListener("click", (e) => {
      e.preventDefault();
      openDatepicker();
      elements.deadlineInput.focus();
    });
  }
  document.addEventListener("click", (e) => {
    if (
      elements.datepickerPopup &&
      elements.datepickerPopup.classList.contains("is-open") &&
      !elements.datepickerPopup.contains(e.target) &&
      !datepickerExcludeEls.some((el) => el && el.contains(e.target))
    ) {
      closeDatepicker();
    }
  });
  if (elements.calendarPrevBtn && elements.calendarNextBtn) {
    elements.calendarPrevBtn.addEventListener("click", () => {
      if (currentCalendarMonth === 0) {
        currentCalendarMonth = 11;
        currentCalendarYear -= 1;
      } else {
        currentCalendarMonth -= 1;
      }
      renderCalendar();
    });
    elements.calendarNextBtn.addEventListener("click", () => {
      if (currentCalendarMonth === 11) {
        currentCalendarMonth = 0;
        currentCalendarYear += 1;
      } else {
        currentCalendarMonth += 1;
      }
      renderCalendar();
    });
  }
}

document.addEventListener("DOMContentLoaded", init);

