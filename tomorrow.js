/**
 * Plan Tomorrow Dedicated Controller
 * Nighttime planning workflow showing tomorrow's recurring habits and one-time tasks.
 */

const Tomorrow = {
  data: null,

  async load() {
    try {
      this.data = await API.get('/api/dashboard/tomorrow');
      this.render();
    } catch (err) {
      console.error("Failed to load tomorrow dashboard:", err);
    }
  },

  render() {
    if (!this.data) return;

    const dateHeader = document.getElementById('tomorrowDateTitle');
    if (dateHeader) {
      dateHeader.textContent = `Tomorrow — ${this.data.date_display}`;
    }

    // Tomorrow's Habits (Automatic Recurrence)
    const habitsContainer = document.getElementById('tomorrowHabitsList');
    if (habitsContainer) {
      const habits = this.data.habits || [];
      if (habits.length === 0) {
        habitsContainer.innerHTML = `<div style="font-size: 0.85rem; color: var(--text-muted); font-style: italic;">No permanent habits scheduled for tomorrow.</div>`;
      } else {
        habitsContainer.innerHTML = habits.map(h => `
          <div class="habit-card" style="cursor: default;">
            <div class="habit-color-stripe" style="background-color: ${h.color || '#10b981'};"></div>
            <div class="habit-icon-pill" style="background-color: ${h.color || '#10b981'}20; color: ${h.color || '#10b981'};">
              ${window.Dashboard.getIconEmoji(h.icon)}
            </div>
            <div class="habit-body">
              <div class="habit-name">${window.Dashboard.escapeHtml(h.name)}</div>
              <div class="habit-sub-info">
                <span>🔄 Permanent Habit</span>
                ${h.goal_value ? `<span>• ${h.goal_value} ${h.goal_unit || ''}</span>` : ''}
                ${h.reminder_enabled ? `<span>• ⏰ ${h.reminder_time || ''}</span>` : ''}
              </div>
            </div>
          </div>
        `).join('');
      }
    }

    // Tomorrow's Planned Tasks
    const tasksContainer = document.getElementById('tomorrowTasksList');
    if (tasksContainer) {
      const tasks = this.data.tasks || [];
      if (tasks.length === 0) {
        tasksContainer.innerHTML = `
          <div class="empty-state" style="padding: 1.5rem;">
            <div class="empty-icon">📝</div>
            <div class="empty-title">No tasks planned yet</div>
            <div class="empty-sub">Take 2 minutes to jot down tomorrow's key tasks before sleeping.</div>
          </div>
        `;
      } else {
        tasksContainer.innerHTML = tasks.map(t => {
          const priorityClass = `priority-${t.priority || 'medium'}`;
          return `
            <div class="task-card">
              <div class="task-body">
                <div class="task-title">${window.Dashboard.escapeHtml(t.title)}</div>
                <div class="task-meta-row">
                  <span class="priority-pill ${priorityClass}">${t.priority || 'medium'}</span>
                  ${t.time ? `<span>🕒 ${t.time}</span>` : ''}
                </div>
              </div>
              <button class="action-dropdown-btn" onclick="Tomorrow.deleteTask(${t.id})" title="Delete" style="color: var(--accent-rose);">🗑</button>
            </div>
          `;
        }).join('');
      }
    }
  },

  async addQuickTask(e) {
    e.preventDefault();
    const input = document.getElementById('tomorrowQuickInput');
    const prioritySelect = document.getElementById('tomorrowPrioritySelect');
    const timeInput = document.getElementById('tomorrowTimeInput');

    const title = input.value.trim();
    if (!title) return;

    if (!this.data || !this.data.date) {
      Toast.error("Could not determine tomorrow's date.");
      return;
    }

    try {
      await API.post('/api/tasks', {
        title,
        date: this.data.date,
        priority: prioritySelect.value,
        time: timeInput.value || null
      });

      input.value = '';
      timeInput.value = '';
      Toast.success("Task planned for tomorrow!");
      await this.load();
      if (window.Dashboard) window.Dashboard.load();
    } catch (err) {
      Toast.error(err.message);
    }
  },

  async deleteTask(taskId) {
    try {
      await API.delete(`/api/tasks/${taskId}`);
      Toast.success("Task removed.");
      await this.load();
      if (window.Dashboard) window.Dashboard.load();
    } catch (err) {
      Toast.error(err.message);
    }
  },

  finishPlanning() {
    Toast.success("Tomorrow is planned! Rest well and conquer tomorrow. 🌙", 4000);
    if (window.App) {
      window.App.switchView('dashboard');
    }
  }
};

window.Tomorrow = Tomorrow;
