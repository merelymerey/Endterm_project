

const STORAGE_KEY = 'claude-todo';
const LIST_COLORS = ['#c96442', '#e09b3d', '#5cb87a', '#4a8fd9', '#9b6cd4', '#d4616e', '#3dbab0'];
const PRIORITY_MAP = { none: 0, low: 1, medium: 2, high: 3 };
const PRIORITY_COLORS = { high: '#d64545', medium: '#e09b3d', low: '#4a9e6e', none: '#9c9488' };

let state = loadState();
let undoStack = []; // { type, data, listId }
let searchQuery = '';
let newTaskPriority = 'none';

function defaultState() {
  return {
    lists: [
      { id: generateId(), name: 'My Tasks', color: LIST_COLORS[0], tasks: [] }
    ],
    activeListId: null,
    theme: 'light',
    filter: 'all',
    sort: 'manual'
  };
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.lists && parsed.lists.length) return parsed;
    }
  } catch (e) { /* ignore */ }
  return defaultState();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ========== DOM Elements ==========
const sidebar = document.getElementById('sidebar');
const sidebarNav = document.getElementById('sidebarNav');
const newListBtn = document.getElementById('newListBtn');
const themeToggle = document.getElementById('themeToggle');
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const listTitle = document.getElementById('listTitle');
const taskCount = document.getElementById('taskCount');
const taskInput = document.getElementById('taskInput');
const addTaskBtn = document.getElementById('addTaskBtn');
const taskList = document.getElementById('taskList');
const emptyState = document.getElementById('emptyState');
const progressSection = document.getElementById('progressSection');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const contextMenu = document.getElementById('contextMenu');
const filterBtns = document.querySelectorAll('.filter-btn');
const searchInput = document.getElementById('searchInput');
const sortBtn = document.getElementById('sortBtn');
const sortMenu = document.getElementById('sortMenu');
const sortLabel = document.getElementById('sortLabel');
const sortOptions = document.querySelectorAll('.sort-option');
const priorityPickerBtn = document.getElementById('priorityPickerBtn');
const priorityMenu = document.getElementById('priorityMenu');
const dueDateInput = document.getElementById('dueDateInput');
const inputTags = document.getElementById('inputTags');
const clearCompletedBtn = document.getElementById('clearCompletedBtn');
const toastContainer = document.getElementById('toastContainer');
const shortcutsModal = document.getElementById('shortcutsModal');
const shortcutsBtn = document.getElementById('shortcutsBtn');
const closeShortcuts = document.getElementById('closeShortcuts');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const importFile = document.getElementById('importFile');

// Stats
const statTotal = document.getElementById('statTotal');
const statCompleted = document.getElementById('statCompleted');
const statOverdue = document.getElementById('statOverdue');

let contextTaskId = null;
let draggedTaskId = null;

// ========== Initialize ==========
function init() {
  if (!state.activeListId || !state.lists.find(l => l.id === state.activeListId)) {
    state.activeListId = state.lists[0].id;
  }
  if (!state.sort) state.sort = 'manual';

  applyTheme(state.theme);
  renderSidebar();
  renderTasks();
  updateFilterButtons();
  updateSortButtons();
  updateStats();

  // Events
  newListBtn.addEventListener('click', createNewList);
  themeToggle.addEventListener('click', toggleTheme);
  mobileMenuBtn.addEventListener('click', toggleMobileSidebar);
  sidebarOverlay.addEventListener('click', closeMobileSidebar);
  addTaskBtn.addEventListener('click', addTask);
  taskInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addTask();
  });

  // Filters
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      state.filter = btn.dataset.filter;
      updateFilterButtons();
      renderTasks();
      saveState();
    });
  });

  // Search
  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value.trim().toLowerCase();
    renderTasks();
  });

  // Sort
  sortBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    sortMenu.classList.toggle('visible');
  });

  sortOptions.forEach(opt => {
    opt.addEventListener('click', () => {
      state.sort = opt.dataset.sort;
      updateSortButtons();
      sortMenu.classList.remove('visible');
      renderTasks();
      saveState();
    });
  });

  // Priority picker
  priorityPickerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    priorityMenu.classList.toggle('visible');
  });

  document.querySelectorAll('#priorityMenu .priority-option').forEach(opt => {
    opt.addEventListener('click', () => {
      newTaskPriority = opt.dataset.priority;
      priorityMenu.classList.remove('visible');
      updateInputTags();
      priorityPickerBtn.classList.toggle('has-value', newTaskPriority !== 'none');
    });
  });

  // Due date
  dueDateInput.addEventListener('change', () => {
    dueDateInput.classList.toggle('has-value', !!dueDateInput.value);
    updateInputTags();
  });

  // Clear completed
  clearCompletedBtn.addEventListener('click', clearCompleted);

  // Shortcuts modal
  shortcutsBtn.addEventListener('click', () => shortcutsModal.classList.add('visible'));
  closeShortcuts.addEventListener('click', () => shortcutsModal.classList.remove('visible'));
  shortcutsModal.addEventListener('click', (e) => {
    if (e.target === shortcutsModal) shortcutsModal.classList.remove('visible');
  });

  // Export/Import
  exportBtn.addEventListener('click', exportData);
  importBtn.addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', importData);

  // Close menus on outside click
  document.addEventListener('click', (e) => {
    if (!contextMenu.contains(e.target)) contextMenu.classList.remove('visible');
    if (!sortBtn.contains(e.target) && !sortMenu.contains(e.target)) sortMenu.classList.remove('visible');
    if (!priorityPickerBtn.contains(e.target) && !priorityMenu.contains(e.target)) priorityMenu.classList.remove('visible');
  });

  // Context menu actions
  contextMenu.querySelectorAll('.context-item').forEach(item => {
    item.addEventListener('click', () => {
      handleContextAction(item.dataset.action);
      contextMenu.classList.remove('visible');
    });
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    const tag = document.activeElement.tagName;
    const isInput = tag === 'INPUT' || tag === 'TEXTAREA';

    if (e.key === 'Escape') {
      contextMenu.classList.remove('visible');
      sortMenu.classList.remove('visible');
      priorityMenu.classList.remove('visible');
      shortcutsModal.classList.remove('visible');
      closeMobileSidebar();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      taskInput.focus();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      searchInput.focus();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      undoLast();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
      e.preventDefault();
      createNewList();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
      e.preventDefault();
      toggleTheme();
    }

    // Number keys to switch filters (only when not typing)
    if (!isInput) {
      if (e.key === '1') { state.filter = 'all'; updateFilterButtons(); renderTasks(); saveState(); }
      if (e.key === '2') { state.filter = 'active'; updateFilterButtons(); renderTasks(); saveState(); }
      if (e.key === '3') { state.filter = 'completed'; updateFilterButtons(); renderTasks(); saveState(); }
    }
  });
}

// ========== Theme ==========
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  state.theme = theme;
}

function toggleTheme() {
  const newTheme = state.theme === 'light' ? 'dark' : 'light';
  applyTheme(newTheme);
  saveState();
}

// ========== Mobile Sidebar ==========
function toggleMobileSidebar() {
  sidebar.classList.toggle('open');
  sidebarOverlay.classList.toggle('visible');
}

function closeMobileSidebar() {
  sidebar.classList.remove('open');
  sidebarOverlay.classList.remove('visible');
}

// ========== Active List Helper ==========
function getActiveList() {
  return state.lists.find(l => l.id === state.activeListId);
}

// ========== Sidebar Render ==========
function renderSidebar() {
  sidebarNav.innerHTML = '';
  state.lists.forEach(list => {
    const taskCountNum = list.tasks.filter(t => !t.completed).length;
    const item = document.createElement('button');
    item.className = `nav-item${list.id === state.activeListId ? ' active' : ''}`;
    item.innerHTML = `
      <span class="list-icon" style="background: ${list.color}"></span>
      <span class="list-name">${escapeHtml(list.name)}</span>
      <span class="list-count">${taskCountNum}</span>
      ${state.lists.length > 1 ? `
        <span class="delete-list-btn" data-list-id="${list.id}" title="Delete list">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </span>
      ` : ''}
    `;

    item.addEventListener('click', (e) => {
      if (e.target.closest('.delete-list-btn')) {
        deleteList(list.id);
        return;
      }
      state.activeListId = list.id;
      renderSidebar();
      renderTasks();
      updateStats();
      saveState();
      closeMobileSidebar();
    });

    const nameEl = item.querySelector('.list-name');
    nameEl.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      renameList(list.id, nameEl);
    });

    sidebarNav.appendChild(item);
  });
}

// ========== List Operations ==========
function createNewList() {
  const color = LIST_COLORS[state.lists.length % LIST_COLORS.length];
  const newList = {
    id: generateId(),
    name: 'New List',
    color: color,
    tasks: []
  };
  state.lists.push(newList);
  state.activeListId = newList.id;
  saveState();
  renderSidebar();
  renderTasks();
  updateStats();

  const navItems = sidebarNav.querySelectorAll('.nav-item');
  const lastItem = navItems[navItems.length - 1];
  const nameEl = lastItem.querySelector('.list-name');
  setTimeout(() => renameList(newList.id, nameEl), 50);
}

function renameList(listId, nameEl) {
  const list = state.lists.find(l => l.id === listId);
  if (!list) return;

  const input = document.createElement('input');
  input.type = 'text';
  input.value = list.name;
  input.className = 'list-name';
  input.style.cssText = 'background:var(--surface);border:1px solid var(--accent);border-radius:4px;padding:2px 6px;font-size:inherit;font-weight:inherit;width:100%;color:var(--text);outline:none;';

  nameEl.replaceWith(input);
  input.focus();
  input.select();

  const finish = () => {
    const newName = input.value.trim() || 'Untitled';
    list.name = newName;
    saveState();
    renderSidebar();
    renderTasks();
  };

  input.addEventListener('blur', finish);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') { input.value = list.name; input.blur(); }
  });
}

function deleteList(listId) {
  if (state.lists.length <= 1) return;
  const idx = state.lists.findIndex(l => l.id === listId);
  state.lists.splice(idx, 1);
  if (state.activeListId === listId) {
    state.activeListId = state.lists[0].id;
  }
  saveState();
  renderSidebar();
  renderTasks();
  updateStats();
}

// ========== Sorting ==========
function getSortedTasks(tasks) {
  if (state.sort === 'manual') return tasks;

  const sorted = [...tasks];
  switch (state.sort) {
    case 'date-new':
      sorted.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      break;
    case 'date-old':
      sorted.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      break;
    case 'priority':
      sorted.sort((a, b) => PRIORITY_MAP[b.priority || 'none'] - PRIORITY_MAP[a.priority || 'none']);
      break;
    case 'alpha':
      sorted.sort((a, b) => a.text.localeCompare(b.text));
      break;
    case 'due':
      sorted.sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      });
      break;
  }
  return sorted;
}

function updateSortButtons() {
  sortOptions.forEach(opt => {
    opt.classList.toggle('active', opt.dataset.sort === state.sort);
  });
  const activeOpt = document.querySelector(`.sort-option[data-sort="${state.sort}"]`);
  if (activeOpt) sortLabel.textContent = activeOpt.textContent;
}

// ========== Task Render ==========
function renderTasks() {
  const list = getActiveList();
  if (!list) return;

  listTitle.textContent = list.name;

  // Filter tasks
  let tasks = list.tasks;
  if (state.filter === 'active') tasks = tasks.filter(t => !t.completed);
  if (state.filter === 'completed') tasks = tasks.filter(t => t.completed);

  // Search
  if (searchQuery) {
    tasks = tasks.filter(t =>
      t.text.toLowerCase().includes(searchQuery) ||
      (t.note && t.note.toLowerCase().includes(searchQuery))
    );
  }

  // Sort
  tasks = getSortedTasks(tasks);

  const total = list.tasks.length;
  const completed = list.tasks.filter(t => t.completed).length;

  taskCount.textContent = `${total} task${total !== 1 ? 's' : ''}`;

  // Render task items
  taskList.innerHTML = '';
  tasks.forEach(task => {
    const item = createTaskElement(task);
    taskList.appendChild(item);
  });

  // Empty state
  emptyState.classList.toggle('visible', tasks.length === 0);

  // Progress
  if (total > 0) {
    const pct = Math.round((completed / total) * 100);
    progressFill.style.width = pct + '%';
    progressText.textContent = `${pct}% complete`;
    progressSection.classList.add('visible');
    clearCompletedBtn.style.display = completed > 0 ? '' : 'none';
  } else {
    progressSection.classList.remove('visible');
  }

  updateStats();
}

function createTaskElement(task) {
  const item = document.createElement('div');
  const priorityClass = task.priority && task.priority !== 'none' ? ` priority-${task.priority}` : '';
  item.className = `task-item${task.completed ? ' completed' : ''}${priorityClass}`;
  item.dataset.id = task.id;
  item.draggable = false; // drag via handle

  // Due date logic
  let dueBadgeHtml = '';
  if (task.dueDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(task.dueDate + 'T00:00:00');
    const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));

    let dueClass = 'due-badge';
    let dueText = formatDate(task.dueDate);
    if (diffDays < 0 && !task.completed) {
      dueClass += ' overdue';
      dueText = `Overdue (${formatDate(task.dueDate)})`;
    } else if (diffDays === 0) {
      dueClass += ' due-today';
      dueText = 'Due today';
    } else if (diffDays === 1) {
      dueText = 'Due tomorrow';
    }
    dueBadgeHtml = `<span class="task-badge ${dueClass}">${dueText}</span>`;
  }

  // Priority badge
  let priorityBadgeHtml = '';
  if (task.priority && task.priority !== 'none') {
    const labels = { high: 'High', medium: 'Med', low: 'Low' };
    priorityBadgeHtml = `<span class="task-badge priority-badge ${task.priority}">${labels[task.priority]}</span>`;
  }

  const metaHtml = (priorityBadgeHtml || dueBadgeHtml)
    ? `<div class="task-meta">${priorityBadgeHtml}${dueBadgeHtml}</div>`
    : '';

  const noteHtml = task.note
    ? `<div class="task-note">${escapeHtml(task.note)}</div>`
    : '';

  item.innerHTML = `
    <div class="drag-handle" title="Drag to reorder">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <circle cx="4" cy="2.5" r="1" fill="currentColor"/>
        <circle cx="8" cy="2.5" r="1" fill="currentColor"/>
        <circle cx="4" cy="6" r="1" fill="currentColor"/>
        <circle cx="8" cy="6" r="1" fill="currentColor"/>
        <circle cx="4" cy="9.5" r="1" fill="currentColor"/>
        <circle cx="8" cy="9.5" r="1" fill="currentColor"/>
      </svg>
    </div>
    <label class="task-checkbox">
      <input type="checkbox" ${task.completed ? 'checked' : ''} />
      <span class="checkmark">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
    </label>
    <div class="task-content">
      <span class="task-text">${escapeHtml(task.text)}</span>
      ${metaHtml}
      ${noteHtml}
    </div>
    <div class="task-actions">
      <button class="task-action-btn note-btn" title="Add note">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M3 3H13V11H7L4 14V11H3V3Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
        </svg>
      </button>
      <button class="task-action-btn edit" title="Edit">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M11.5 2.5L13.5 4.5L5 13H3V11L11.5 2.5Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
        </svg>
      </button>
      <button class="task-action-btn delete" title="Delete">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
  `;

  // Checkbox toggle
  const checkbox = item.querySelector('input[type="checkbox"]');
  checkbox.addEventListener('change', () => {
    task.completed = checkbox.checked;
    saveState();
    renderTasks();
    renderSidebar();
  });

  // Edit button
  item.querySelector('.task-action-btn.edit').addEventListener('click', (e) => {
    e.stopPropagation();
    editTask(task.id, item);
  });

  // Note button
  item.querySelector('.task-action-btn.note-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    editNote(task.id, item);
  });

  // Delete button
  item.querySelector('.task-action-btn.delete').addEventListener('click', (e) => {
    e.stopPropagation();
    deleteTask(task.id, item);
  });

  // Right-click context menu
  item.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    contextTaskId = task.id;
    showContextMenu(e.clientX, e.clientY);
  });

  // Drag & drop via handle
  const handle = item.querySelector('.drag-handle');
  handle.addEventListener('mousedown', () => {
    item.draggable = true;
  });

  item.addEventListener('dragstart', (e) => {
    draggedTaskId = task.id;
    item.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });

  item.addEventListener('dragend', () => {
    item.draggable = false;
    item.classList.remove('dragging');
    document.querySelectorAll('.task-item.drag-over').forEach(el => el.classList.remove('drag-over'));
    draggedTaskId = null;
  });

  item.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (task.id !== draggedTaskId) {
      item.classList.add('drag-over');
    }
  });

  item.addEventListener('dragleave', () => {
    item.classList.remove('drag-over');
  });

  item.addEventListener('drop', (e) => {
    e.preventDefault();
    item.classList.remove('drag-over');
    if (!draggedTaskId || draggedTaskId === task.id) return;

    const list = getActiveList();
    const fromIdx = list.tasks.findIndex(t => t.id === draggedTaskId);
    const toIdx = list.tasks.findIndex(t => t.id === task.id);
    if (fromIdx === -1 || toIdx === -1) return;

    const [moved] = list.tasks.splice(fromIdx, 1);
    list.tasks.splice(toIdx, 0, moved);

    // Switch to manual sort when dragging
    state.sort = 'manual';
    updateSortButtons();
    saveState();
    renderTasks();
  });

  return item;
}

// ========== Task Operations ==========
function addTask() {
  const text = taskInput.value.trim();
  if (!text) {
    taskInput.focus();
    const container = document.getElementById('taskInputContainer');
    container.style.animation = 'none';
    container.offsetHeight;
    container.style.animation = 'shake 0.4s ease';
    setTimeout(() => container.style.animation = '', 400);
    return;
  }

  const list = getActiveList();
  list.tasks.unshift({
    id: generateId(),
    text: text,
    completed: false,
    priority: newTaskPriority,
    dueDate: dueDateInput.value || null,
    note: '',
    createdAt: Date.now()
  });

  taskInput.value = '';
  newTaskPriority = 'none';
  dueDateInput.value = '';
  dueDateInput.classList.remove('has-value');
  priorityPickerBtn.classList.remove('has-value');
  updateInputTags();
  taskInput.focus();
  saveState();
  renderTasks();
  renderSidebar();
}

function editTask(taskId, itemEl) {
  const list = getActiveList();
  const task = list.tasks.find(t => t.id === taskId);
  if (!task) return;

  const textEl = itemEl.querySelector('.task-text');
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'task-text-input';
  input.value = task.text;

  textEl.replaceWith(input);
  input.focus();
  input.select();

  const finish = () => {
    const newText = input.value.trim();
    if (newText) task.text = newText;
    saveState();
    renderTasks();
  };

  input.addEventListener('blur', finish);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') { input.value = task.text; input.blur(); }
  });
}

function editNote(taskId, itemEl) {
  const list = getActiveList();
  const task = list.tasks.find(t => t.id === taskId);
  if (!task) return;

  // Check if already editing
  if (itemEl.querySelector('.task-note-input')) return;

  const contentEl = itemEl.querySelector('.task-content');
  const textarea = document.createElement('textarea');
  textarea.className = 'task-note-input';
  textarea.value = task.note || '';
  textarea.placeholder = 'Add a note...';
  contentEl.appendChild(textarea);
  textarea.focus();

  const finish = () => {
    task.note = textarea.value.trim();
    saveState();
    renderTasks();
  };

  textarea.addEventListener('blur', finish);
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) textarea.blur();
    if (e.key === 'Escape') { textarea.value = task.note || ''; textarea.blur(); }
  });
}

function deleteTask(taskId, itemEl) {
  const list = getActiveList();
  const task = list.tasks.find(t => t.id === taskId);
  const idx = list.tasks.indexOf(task);

  // Save for undo
  undoStack.push({ type: 'delete', data: { ...task }, index: idx, listId: list.id });

  itemEl.classList.add('removing');
  setTimeout(() => {
    list.tasks = list.tasks.filter(t => t.id !== taskId);
    saveState();
    renderTasks();
    renderSidebar();
  }, 280);

  showToast('Task deleted', 'Undo', () => undoLast());
}

function duplicateTask(taskId) {
  const list = getActiveList();
  const task = list.tasks.find(t => t.id === taskId);
  if (!task) return;

  const idx = list.tasks.indexOf(task);
  const duplicate = {
    id: generateId(),
    text: task.text,
    completed: false,
    priority: task.priority || 'none',
    dueDate: task.dueDate || null,
    note: task.note || '',
    createdAt: Date.now()
  };
  list.tasks.splice(idx + 1, 0, duplicate);
  saveState();
  renderTasks();
  renderSidebar();
}

function clearCompleted() {
  const list = getActiveList();
  const completed = list.tasks.filter(t => t.completed);
  if (!completed.length) return;

  // Save for undo
  undoStack.push({
    type: 'clear',
    data: completed.map((t, i) => ({ task: { ...t }, index: list.tasks.indexOf(t) })),
    listId: list.id
  });

  list.tasks = list.tasks.filter(t => !t.completed);
  saveState();
  renderTasks();
  renderSidebar();
  showToast(`${completed.length} task${completed.length > 1 ? 's' : ''} cleared`, 'Undo', () => undoLast());
}

// ========== Undo ==========
function undoLast() {
  if (!undoStack.length) return;
  const action = undoStack.pop();
  const list = state.lists.find(l => l.id === action.listId);
  if (!list) return;

  if (action.type === 'delete') {
    list.tasks.splice(action.index, 0, action.data);
  } else if (action.type === 'clear') {
    // Re-insert in original positions
    action.data.sort((a, b) => a.index - b.index);
    action.data.forEach(item => {
      list.tasks.splice(item.index, 0, item.task);
    });
  }

  saveState();
  renderTasks();
  renderSidebar();
  showToast('Action undone');
}

// ========== Context Menu ==========
function showContextMenu(x, y) {
  contextMenu.classList.add('visible');
  const menuRect = contextMenu.getBoundingClientRect();
  const maxX = window.innerWidth - menuRect.width - 8;
  const maxY = window.innerHeight - menuRect.height - 8;
  contextMenu.style.left = Math.min(x, maxX) + 'px';
  contextMenu.style.top = Math.min(y, maxY) + 'px';
}

function handleContextAction(action) {
  if (!contextTaskId) return;
  const list = getActiveList();
  const task = list.tasks.find(t => t.id === contextTaskId);

  if (action === 'edit') {
    const itemEl = taskList.querySelector(`[data-id="${contextTaskId}"]`);
    if (itemEl) editTask(contextTaskId, itemEl);
  } else if (action === 'duplicate') {
    duplicateTask(contextTaskId);
  } else if (action === 'delete') {
    const itemEl = taskList.querySelector(`[data-id="${contextTaskId}"]`);
    if (itemEl) deleteTask(contextTaskId, itemEl);
  } else if (action.startsWith('priority-')) {
    const priority = action.replace('priority-', '');
    if (task) {
      task.priority = priority;
      saveState();
      renderTasks();
    }
  }

  contextTaskId = null;
}

// ========== Input Tags ==========
function updateInputTags() {
  inputTags.innerHTML = '';
  if (newTaskPriority !== 'none') {
    const tag = document.createElement('span');
    tag.className = 'input-tag priority-tag';
    tag.innerHTML = `<span class="priority-dot" style="background:${PRIORITY_COLORS[newTaskPriority]}"></span> ${newTaskPriority} <span class="remove-tag">&times;</span>`;
    tag.addEventListener('click', () => {
      newTaskPriority = 'none';
      priorityPickerBtn.classList.remove('has-value');
      updateInputTags();
    });
    inputTags.appendChild(tag);
  }
  if (dueDateInput.value) {
    const tag = document.createElement('span');
    tag.className = 'input-tag date-tag';
    tag.innerHTML = `${formatDate(dueDateInput.value)} <span class="remove-tag">&times;</span>`;
    tag.addEventListener('click', () => {
      dueDateInput.value = '';
      dueDateInput.classList.remove('has-value');
      updateInputTags();
    });
    inputTags.appendChild(tag);
  }
}

// ========== Stats ==========
function updateStats() {
  let totalAll = 0, completedAll = 0, overdueAll = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  state.lists.forEach(list => {
    list.tasks.forEach(task => {
      totalAll++;
      if (task.completed) completedAll++;
      if (task.dueDate && !task.completed) {
        const due = new Date(task.dueDate + 'T00:00:00');
        if (due < today) overdueAll++;
      }
    });
  });

  statTotal.textContent = totalAll;
  statCompleted.textContent = completedAll;
  statOverdue.textContent = overdueAll;
  statOverdue.style.display = overdueAll > 0 ? '' : '';
}

// ========== Toast ==========
function showToast(message, actionText, actionFn) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>${escapeHtml(message)}</span>`;

  if (actionText && actionFn) {
    const btn = document.createElement('button');
    btn.className = 'toast-action';
    btn.textContent = actionText;
    btn.addEventListener('click', () => {
      actionFn();
      removeToast(toast);
    });
    toast.appendChild(btn);
  }

  toastContainer.appendChild(toast);

  const timer = setTimeout(() => removeToast(toast), 4000);
  toast._timer = timer;
}

function removeToast(toast) {
  if (toast._removed) return;
  toast._removed = true;
  clearTimeout(toast._timer);
  toast.classList.add('removing');
  setTimeout(() => toast.remove(), 300);
}

// ========== Export / Import ==========
function exportData() {
  const data = JSON.stringify(state, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `todo-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Data exported');
}

function importData(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (data.lists && data.lists.length) {
        state = data;
        if (!state.sort) state.sort = 'manual';
        saveState();
        renderSidebar();
        renderTasks();
        updateStats();
        updateSortButtons();
        updateFilterButtons();
        showToast('Data imported successfully');
      } else {
        showToast('Invalid file format');
      }
    } catch (err) {
      showToast('Failed to parse file');
    }
  };
  reader.readAsText(file);
  importFile.value = '';
}

// ========== Filter ==========
function updateFilterButtons() {
  filterBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === state.filter);
  });
}

// ========== Utilities ==========
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}

// Shake animation style
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20% { transform: translateX(-5px); }
    40% { transform: translateX(5px); }
    60% { transform: translateX(-3px); }
    80% { transform: translateX(3px); }
  }
`;
document.head.appendChild(shakeStyle);

// ========== Start ==========
init();
