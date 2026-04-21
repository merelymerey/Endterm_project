// ========== Custom Confirm Modal ==========
function customConfirm(message, title = 'Are you sure?') {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirmModal');
    const msgEl = document.getElementById('confirmMessage');
    const titleEl = document.getElementById('confirmTitle');
    const okBtn = document.getElementById('confirmOk');
    const cancelBtn = document.getElementById('confirmCancel');
    if (!modal || !msgEl || !okBtn || !cancelBtn) {
      resolve(window.confirm(message));
      return;
    }
    msgEl.textContent = message;
    if (titleEl) titleEl.textContent = title;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');

    const cleanup = (result) => {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      modal.removeEventListener('click', onBackdrop);
      document.removeEventListener('keydown', onKey);
      resolve(result);
    };
    const onOk = () => cleanup(true);
    const onCancel = () => cleanup(false);
    const onBackdrop = (e) => { if (e.target.classList.contains('confirm-backdrop')) cleanup(false); };
    const onKey = (e) => {
      if (e.key === 'Escape') cleanup(false);
      if (e.key === 'Enter') cleanup(true);
    };

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    modal.addEventListener('click', onBackdrop);
    document.addEventListener('keydown', onKey);
    setTimeout(() => okBtn.focus(), 50);
  });
}

document.querySelectorAll('form[data-confirm]').forEach((form) => {
  form.addEventListener('submit', async (e) => {
    if (form.dataset.confirmed === '1') return;
    e.preventDefault();
    const ok = await customConfirm(form.dataset.confirm, form.dataset.confirmTitle || 'Are you sure?');
    if (ok) {
      form.dataset.confirmed = '1';
      form.submit();
    }
  });
});

// ========== Theme Toggle ==========
const themeToggle = document.getElementById('themeToggle');
if (themeToggle) {
  const saved = localStorage.getItem('theme') || 'light';
  document.body.setAttribute('data-theme', saved);

  themeToggle.addEventListener('click', () => {
    const current = document.body.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    document.body.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  });
}

// ========== Mobile Sidebar ==========
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');

if (mobileMenuBtn && sidebar) {
  mobileMenuBtn.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    if (sidebarOverlay) sidebarOverlay.classList.toggle('visible');
  });
}

if (sidebarOverlay) {
  sidebarOverlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('visible');
  });
}

// ========== CSRF Token Helper ==========
function getCookie(name) {
  const cookies = document.cookie.split(';');
  for (let c of cookies) {
    c = c.trim();
    if (c.startsWith(name + '=')) {
      return decodeURIComponent(c.substring(name.length + 1));
    }
  }
  return null;
}

const csrfToken = getCookie('csrftoken');

// ========== Status Toggle (AJAX) ==========
const STATUS_CYCLE = { 'todo': 'in_progress', 'in_progress': 'done', 'done': 'todo' };

document.querySelectorAll('.task-status-toggle').forEach(toggle => {
  toggle.addEventListener('click', async () => {
    const current = toggle.dataset.current;
    const next = STATUS_CYCLE[current];
    const row = toggle.closest('[data-task-id]');
    const taskId = row.dataset.taskId;
    const projectId = row.dataset.projectId;

    try {
      const res = await fetch(`/projects/${projectId}/tasks/${taskId}/status/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken,
        },
        body: JSON.stringify({ status: next }),
      });

      if (res.ok) {
        const data = await res.json();
        // Update status dot
        const dot = toggle.querySelector('.status-dot');
        if (dot) {
          dot.className = `status-dot status-${next}`;
        }
        // Update badge
        const badge = toggle.querySelector('.status-badge');
        if (badge) {
          badge.className = `task-badge status-badge status-${next}`;
          const labels = { todo: 'To Do', in_progress: 'In Progress', done: 'Done' };
          badge.textContent = labels[next];
        }
        toggle.dataset.current = next;

        // Update text strikethrough
        const textEl = row.querySelector('.task-text');
        if (textEl) {
          textEl.classList.toggle('task-done', next === 'done');
        }

        // Update row style for table view
        if (row.tagName === 'TR') {
          row.classList.toggle('row-done', next === 'done');
        }

        // Update progress bar
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        if (progressFill && data.progress !== undefined) {
          progressFill.style.width = data.progress + '%';
          if (progressText) progressText.textContent = data.progress + '% complete';
        }

        showToast(`Task marked as ${next.replace('_', ' ')}`);
      }
    } catch (err) {
      showToast('Failed to update task');
    }
  });
});

// ========== Delete Task (AJAX) ==========
async function deleteTask(projectId, taskId, btn) {
  if (!(await customConfirm('Delete this task?', 'Delete task?'))) return;

  const row = btn.closest('[data-task-id]');

  try {
    const res = await fetch(`/projects/${projectId}/tasks/${taskId}/delete/`, {
      method: 'POST',
      headers: { 'X-CSRFToken': csrfToken },
    });

    if (res.ok) {
      if (row) {
        row.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => row.remove(), 300);
      }
      showToast('Task deleted');
    }
  } catch (err) {
    showToast('Failed to delete task');
  }
}

// ========== Toast ==========
function showToast(message) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ========== Apply saved theme on page load ==========
(function () {
  const saved = localStorage.getItem('theme');
  if (saved) document.body.setAttribute('data-theme', saved);
})();
