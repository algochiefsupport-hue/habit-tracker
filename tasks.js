/**
 * Daily Task Planner Controller
 * Date navigation, task CRUD, priority handling, drag-and-drop reordering.
 */

const Tasks = {
  currentDate: new Date().toISOString().substring(0, 10),
  tasksList: [],
  editingTaskId: null,
  draggedIndex: null,

  async load() {
    this.updateDateHeader();
    try {
      const data = await API.get(`/api/tasks?date=${this.currentDate}`);
      this.tasksList = data.tasks || [];
      this.render();
    } catch (err) {
      console.error("Failed to load tasks:", err);
    }
  },

  setDate(dateStr) {
    this.currentDate = dateStr;
    const picker = document.getElementById('taskDatePicker');
    if (picker) picker.value = dateStr;
    this.load();
  },

  prevDay() {
    const d = new Date(this.currentDate);
    d.setDate(d.getDate() - 1);
    this.setDate(d.toISOString().substring(0, 10));
  },

  nextDay() {
    const d = new Date(this.currentDate);
    d.setDate(d.getDate() + 1);
    this.setDate(d.toISOString().substring(0, 10));
  },

  today() {
    this.setDate(new Date().toISOString().substring(0, 10));
  },

  updateDateHeader() {
    const d = new Date(this.currentDate + 'T00:00:00');
    const todayStr = new Date().toISOString().substring(0, 10);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().substring(0, 10);

    let prefix = '';
    if (this.currentDate === todayStr) prefix = 'Today • ';
    else if (this.currentDate === tomorrowStr) prefix = 'Tomorrow • ';

    const display = d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
    const titleEl = document.getElementById('tasksDateTitle');
    if (titleEl) titleEl.textContent = `${prefix}${display}`;
  },

  render() {
    const container = document.getElementById('tasksListContainer');
    if (!container) return;

    if (this.tasksList.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📝</div>
          <div class="empty-title">No tasks for this day</div>
          <div class="empty-sub">Plan your schedule and stay focused on what matters most.</div>
          <button class="btn-primary-quick" onclick="Tasks.openCreateModal()" style="border-radius: var(--radius-md);">
            <span>+ Add Task</span>
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = this.tasksList.map((t, index) => {
      const isChecked = t.completed;
      const priorityClass = `priority-${t.priority || 'medium'}`;

      return `
        <div class="task-card ${isChecked ? 'is-completed' : ''}"
             data-id="${t.id}"
             data-index="${index}"
             draggable="true"
             ondragstart="Tasks.handleDragStart(event, ${index})"
             ondragover="Tasks.handleDragOver(event)"
             ondrop="Tasks.handleDrop(event, ${index})">

          <div class="task-drag-handle" title="Drag to reorder">⋮⋮</div>

          <button class="task-check-btn ${isChecked ? 'checked' : ''}"
                  onclick="Tasks.toggleTask(${t.id})"
                  title="${isChecked ? 'Mark incomplete' : 'Mark completed'}"
                  aria-label="Toggle task">
            ✓
          </button>

          <div class="task-body">
            <div class="task-title">${window.Dashboard.escapeHtml(t.title)}</div>
            ${t.description ? `<div style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.2rem;">${window.Dashboard.escapeHtml(t.description)}</div>` : ''}
            <div class="task-meta-row">
              <span class="priority-pill ${priorityClass}">${t.priority || 'medium'}</span>
              ${t.time ? `<span>🕒 ${t.time}</span>` : ''}
              ${t.category_name ? `<span>📁 ${window.Dashboard.escapeHtml(t.category_name)}</span>` : ''}
            </div>
          </div>

          <div style="display: flex; gap: 0.25rem;">
            <button class="action-dropdown-btn" onclick="Tasks.moveTaskPrompt(${t.id})" title="Move to another date">📅</button>
            <button class="action-dropdown-btn" onclick="Tasks.duplicateTask(${t.id})" title="Duplicate task">📋</button>
            <button class="action-dropdown-btn" onclick="Tasks.openEditModal(${t.id})" title="Edit task">✎</button>
            <button class="action-dropdown-btn" onclick="Tasks.deleteTask(${t.id})" title="Delete task" style="color: var(--accent-rose);">🗑</button>
          </div>
        </div>
      `;
    }).join('');
  },

  openCreateModal() {
    this.editingTaskId = null;
    document.getElementById('taskModalTitle').textContent = "Add Task";
    document.getElementById('taskTitleInput').value = "";
    document.getElementById('taskDescInput').value = "";
    document.getElementById('taskDateInput').value = this.currentDate;
    document.getElementById('taskTimeInput').value = "";
    document.getElementById('taskPrioritySelect').value = "medium";
    document.getElementById('taskReminderEnabled').checked = false;

    this.populateCategories();
    document.getElementById('taskModal').classList.add('open');
  },

  async openEditModal(taskId) {
    this.editingTaskId = taskId;
    document.getElementById('taskModalTitle').textContent = "Edit Task";

    const t = this.tasksList.find(x => x.id === taskId);
    if (!t) return;

    document.getElementById('taskTitleInput').value = t.title || "";
    document.getElementById('taskDescInput').value = t.description || "";
    document.getElementById('taskDateInput').value = t.date || this.currentDate;
    document.getElementById('taskTimeInput').value = t.time || "";
    document.getElementById('taskPrioritySelect').value = t.priority || "medium";
    document.getElementById('taskReminderEnabled').checked = Boolean(t.reminder_enabled);

    await this.populateCategories(t.category_id);
    document.getElementById('taskModal').classList.add('open');
  },

  async populateCategories(selectedId = null) {
    const sel = document.getElementById('taskCategorySelect');
    if (!sel) return;
    try {
      const data = await API.get('/api/categories');
      sel.innerHTML = '<option value="">(None)</option>' + (data.categories || []).map(c => `
        <option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${window.Dashboard.escapeHtml(c.name)}</option>
      `).join('');
    } catch (e) {
      console.warn("Failed to populate categories:", e);
    }
  },

  async saveTask() {
    const title = document.getElementById('taskTitleInput').value.trim();
    if (!title) {
      Toast.error("Task title is required.");
      return;
    }

    const payload = {
      title,
      description: document.getElementById('taskDescInput').value.trim(),
      date: document.getElementById('taskDateInput').value || this.currentDate,
      time: document.getElementById('taskTimeInput').value || null,
      priority: document.getElementById('taskPrioritySelect').value,
      category_id: document.getElementById('taskCategorySelect').value || null,
      reminder_enabled: document.getElementById('taskReminderEnabled').checked,
      reminder_time: document.getElementById('taskTimeInput').value || null
    };

    try {
      if (this.editingTaskId) {
        await API.put(`/api/tasks/${this.editingTaskId}`, payload);
        Toast.success("Task updated!");
      } else {
        await API.post('/api/tasks', payload);
        Toast.success("Task created!");
      }

      document.getElementById('taskModal').classList.remove('open');
      await this.load();
      if (window.Dashboard) window.Dashboard.load();
    } catch (err) {
      Toast.error(err.message);
    }
  },

  async toggleTask(taskId) {
    try {
      const res = await API.patch(`/api/tasks/${taskId}/toggle`, {});
      if (res.completed && window.SoundManager) {
        window.SoundManager.playCompletionChime();
      }
      Toast.success(res.message);
      await this.load();
      if (window.Dashboard) window.Dashboard.load();
    } catch (err) {
      Toast.error(err.message);
    }
  },

  async moveTaskPrompt(taskId) {
    const newDate = prompt("Enter new date (YYYY-MM-DD):", this.currentDate);
    if (!newDate) return;

    try {
      await API.patch(`/api/tasks/${taskId}/move`, { date: newDate });
      Toast.success(`Task moved to ${newDate}!`);
      await this.load();
      if (window.Dashboard) window.Dashboard.load();
    } catch (err) {
      Toast.error(err.message);
    }
  },

  async duplicateTask(taskId) {
    try {
      await API.post(`/api/tasks/${taskId}/duplicate`, { date: this.currentDate });
      Toast.success("Task duplicated!");
      await this.load();
    } catch (err) {
      Toast.error(err.message);
    }
  },

  async deleteTask(taskId) {
    if (!confirm("Delete this task?")) return;
    try {
      await API.delete(`/api/tasks/${taskId}`);
      Toast.success("Task deleted.");
      await this.load();
      if (window.Dashboard) window.Dashboard.load();
    } catch (err) {
      Toast.error(err.message);
    }
  },

  // HTML5 Drag and Drop Reordering
  handleDragStart(e, index) {
    this.draggedIndex = index;
    e.dataTransfer.effectAllowed = 'move';
  },

  handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  },

  async handleDrop(e, targetIndex) {
    e.preventDefault();
    if (this.draggedIndex === null || this.draggedIndex === targetIndex) return;

    const movedItem = this.tasksList.splice(this.draggedIndex, 1)[0];
    this.tasksList.splice(targetIndex, 0, movedItem);

    this.render();

    // Persist reorder to backend
    const taskIds = this.tasksList.map(t => t.id);
    try {
      await API.patch('/api/tasks/reorder', { task_ids: taskIds });
    } catch (err) {
      console.warn("Failed to persist task reorder:", err);
    }
    this.draggedIndex = null;
  }
};

window.Tasks = Tasks;
