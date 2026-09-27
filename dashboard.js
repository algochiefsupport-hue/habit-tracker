/**
 * Main Dashboard Controller (Today View)
 */

const Dashboard = {
  todayHabits: [],
  todayTasks: [],

  async load() {
    try {
      const data = await API.get('/api/dashboard/today');
      this.render(data);
    } catch (err) {
      console.error("Failed to load today dashboard:", err);
    }
  },

  render(data) {
    this.todayHabits = data.habits || [];
    this.todayTasks = data.tasks || [];

    // Header Greeting & Date
    const greetingEl = document.getElementById('dashGreeting');
    if (greetingEl) greetingEl.textContent = `${data.greeting} 👋`;

    const dateEl = document.getElementById('dashDate');
    if (dateEl) dateEl.textContent = data.date_display;

    const quoteEl = document.getElementById('dashQuote');
    if (quoteEl) quoteEl.textContent = `“${data.quote}”`;

    // Motivation Banner
    const motivationEl = document.getElementById('dashMotivation');
    if (motivationEl) {
      if (data.motivation) {
        motivationEl.style.display = 'flex';
        document.getElementById('dashMotivationText').textContent = data.motivation;
      } else {
        motivationEl.style.display = 'none';
      }
    }

    // Progress Ring & Counts
    const progress = data.progress;
    this.updateProgressRing(progress.percent, progress.completed_items, progress.total_items);

    // Render Today's Habits
    this.renderHabits(this.todayHabits);

    // Render Today's Tasks
    this.renderTasks(this.todayTasks);

    // Render Tomorrow Preview
    const tomorrowPreview = data.tomorrow_preview;
    const tomorrowBanner = document.getElementById('tomorrowPreviewBanner');
    if (tomorrowBanner) {
      document.getElementById('tomorrowCountText').textContent =
        `${tomorrowPreview.tasks_count} tasks planned for tomorrow`;
    }

    // Check if evening or has unfinished tasks to show review card
    const currentHour = new Date().getHours();
    const reviewCard = document.getElementById('eveningReviewCard');
    if (reviewCard) {
      const unfinishedTasks = this.todayTasks.filter(t => !t.completed);
      if (currentHour >= 18 && unfinishedTasks.length > 0) {
        reviewCard.style.display = 'flex';
        document.getElementById('unfinishedTasksCount').textContent =
          `${unfinishedTasks.length} unfinished task${unfinishedTasks.length > 1 ? 's' : ''}`;
      } else {
        reviewCard.style.display = 'none';
      }
    }
  },

  updateProgressRing(percent, completed, total) {
    const circle = document.getElementById('dashProgressCircle');
    const percentEl = document.getElementById('dashProgressPercent');
    const ratioEl = document.getElementById('dashProgressRatio');
    const habitsRatioEl = document.getElementById('dashHabitsRatio');
    const tasksRatioEl = document.getElementById('dashTasksRatio');

    if (percentEl) percentEl.textContent = `${percent}%`;
    if (ratioEl) ratioEl.textContent = `${completed} / ${total} completed`;

    if (circle) {
      const circumference = 283; // 2 * PI * 45
      const offset = circumference - (percent / 100) * circumference;
      circle.style.strokeDashoffset = offset;
    }

    if (habitsRatioEl && this.todayHabits) {
      const hCompleted = this.todayHabits.filter(h => h.is_completed).length;
      habitsRatioEl.textContent = `${hCompleted} / ${this.todayHabits.length}`;
    }

    if (tasksRatioEl && this.todayTasks) {
      const tCompleted = this.todayTasks.filter(t => t.completed).length;
      tasksRatioEl.textContent = `${tCompleted} / ${this.todayTasks.length}`;
    }
  },

  renderHabits(habits) {
    const container = document.getElementById('todayHabitsList');
    if (!container) return;

    if (!habits || habits.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding: 1.5rem;">
          <div class="empty-icon">🎯</div>
          <div class="empty-title">No habits scheduled for today</div>
          <div class="empty-sub">Add a daily habit to begin building your consistency.</div>
          <button class="btn-secondary" onclick="window.Habits.openCreateModal()">+ Create Habit</button>
        </div>
      `;
      return;
    }

    container.innerHTML = habits.map(h => {
      const streak = (h.stats && h.stats.current_streak) || 0;
      const streakDisplay = streak > 0 ? `🔥 ${streak} day streak` : `🔥 0 day streak`;
      const isChecked = h.is_completed;
      const color = h.color || '#10b981';
      const goalDisplay = h.goal_value ? `• ${h.goal_value} ${h.goal_unit || ''}` : '';

      return `
        <div class="habit-card ${isChecked ? 'is-completed' : ''}" data-id="${h.id}">
          <div class="habit-color-stripe" style="background-color: ${color};"></div>
          <button class="habit-check-btn ${isChecked ? 'checked' : ''}"
                  onclick="Dashboard.toggleHabit(${h.id}, event)"
                  title="${isChecked ? 'Mark incomplete' : 'Mark completed'}"
                  aria-label="Toggle habit completion">
            ✓
          </button>
          <div class="habit-icon-pill" style="background-color: ${color}20; color: ${color};">
            ${this.getIconEmoji(h.icon)}
          </div>
          <div class="habit-body" onclick="window.Habits.openHabitDetails(${h.id})">
            <div class="habit-name">${this.escapeHtml(h.name)}</div>
            <div class="habit-sub-info">
              <span class="streak-tag">${streakDisplay}</span>
              ${goalDisplay ? `<span class="frequency-tag">${goalDisplay}</span>` : ''}
              ${h.category_name ? `<span class="frequency-tag">• ${this.escapeHtml(h.category_name)}</span>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  renderTasks(tasks) {
    const container = document.getElementById('todayTasksList');
    if (!container) return;

    if (!tasks || tasks.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding: 1.5rem;">
          <div class="empty-icon">📋</div>
          <div class="empty-title">No one-time tasks for today</div>
          <div class="empty-sub">Focus on your permanent habits or write down today's tasks.</div>
          <button class="btn-secondary" onclick="window.Tasks.openCreateModal()">+ Add Today's Task</button>
        </div>
      `;
      return;
    }

    container.innerHTML = tasks.map(t => {
      const isChecked = t.completed;
      const priorityClass = `priority-${t.priority || 'medium'}`;

      return `
        <div class="task-card ${isChecked ? 'is-completed' : ''}" data-id="${t.id}">
          <button class="task-check-btn ${isChecked ? 'checked' : ''}"
                  onclick="Dashboard.toggleTask(${t.id}, event)"
                  title="${isChecked ? 'Mark incomplete' : 'Mark completed'}"
                  aria-label="Toggle task completion">
            ✓
          </button>
          <div class="task-body">
            <div class="task-title">${this.escapeHtml(t.title)}</div>
            <div class="task-meta-row">
              <span class="priority-pill ${priorityClass}">${t.priority || 'medium'}</span>
              ${t.time ? `<span>🕒 ${t.time}</span>` : ''}
              ${t.category_name ? `<span>📁 ${this.escapeHtml(t.category_name)}</span>` : ''}
            </div>
          </div>
          <div style="display: flex; gap: 0.25rem;">
            ${!isChecked ? `
              <button class="action-dropdown-btn" onclick="Dashboard.moveTaskToTomorrow(${t.id})" title="Move to tomorrow">
                →
              </button>
            ` : ''}
            <button class="action-dropdown-btn" onclick="window.Tasks.openEditModal(${t.id})" title="Edit task">
              ✎
            </button>
          </div>
        </div>
      `;
    }).join('');
  },

  async toggleHabit(habitId, event) {
    if (event) event.stopPropagation();
    try {
      const res = await API.post(`/api/habits/${habitId}/toggle`, {
        date: new Date().toISOString().substring(0, 10)
      });

      if (res.is_completed && window.SoundManager) {
        window.SoundManager.playCompletionChime();
      }

      Toast.success(res.message);
      // Reload dashboard immediately for real-time progress update
      await this.load();
    } catch (err) {
      Toast.error(err.message);
    }
  },

  async toggleTask(taskId, event) {
    if (event) event.stopPropagation();
    try {
      const res = await API.patch(`/api/tasks/${taskId}/toggle`, {});

      if (res.completed && window.SoundManager) {
        window.SoundManager.playCompletionChime();
      }

      Toast.success(res.message);
      await this.load();
    } catch (err) {
      Toast.error(err.message);
    }
  },

  async moveTaskToTomorrow(taskId) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().substring(0, 10);

    try {
      await API.patch(`/api/tasks/${taskId}/move`, { date: tomorrowStr });
      Toast.success("Task moved to tomorrow!");
      await this.load();
    } catch (err) {
      Toast.error(err.message);
    }
  },

  async carryForwardAll() {
    try {
      const today = new Date().toISOString().substring(0, 10);
      const res = await API.post('/api/dashboard/carry-forward', { from_date: today });
      Toast.success(res.message);
      await this.load();
    } catch (err) {
      Toast.error(err.message);
    }
  },

  getIconEmoji(iconName) {
    const map = {
      'target': '🎯', 'heart-pulse': '❤️', 'dumbbell': '💪', 'book-open': '📖',
      'code': '💻', 'moon': '🌙', 'droplet': '💧', 'smile': '🧘',
      'coffee': '☕', 'sun': '☀️', 'apple': '🍏', 'briefcase': '💼',
      'wallet': '💰', 'feather': '✍️', 'music': '🎵', 'clock': '⏰'
    };
    return map[iconName] || '🎯';
  },

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
  }
};

window.Dashboard = Dashboard;
