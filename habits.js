/**
 * Habits Management & Habit Details Controller
 */

const Habits = {
  currentTab: 'active',
  habitsList: [],
  selectedDays: [0, 1, 2, 3, 4, 5, 6],
  selectedIcon: 'target',
  selectedColor: '#10b981',
  editingHabitId: null,

  async load() {
    try {
      const data = await API.get(`/api/habits?status=${this.currentTab}`);
      this.habitsList = data.habits || [];
      this.render();
    } catch (err) {
      console.error("Failed to load habits:", err);
    }
  },

  switchTab(tab) {
    this.currentTab = tab;
    document.querySelectorAll('.habit-tab-chip').forEach(el => {
      el.classList.toggle('active', el.dataset.tab === tab);
    });
    this.load();
  },

  render() {
    const container = document.getElementById('habitsListContainer');
    if (!container) return;

    if (this.habitsList.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🌱</div>
          <div class="empty-title">No ${this.currentTab} habits</div>
          <div class="empty-sub">Create your first recurring habit and start building positive routines.</div>
          <button class="btn-primary-quick" onclick="Habits.openCreateModal()" style="border-radius: var(--radius-md);">
            <span>+ Create Habit</span>
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = this.habitsList.map(h => {
      const stats = h.stats || {};
      const streak = stats.current_streak || 0;
      const rate = stats.completion_rate || 0;
      const color = h.color || '#10b981';

      return `
        <div class="card" style="margin-bottom: 0.85rem; padding: 1.15rem; display: flex; align-items: center; gap: 1rem; position: relative;">
          <div style="width: 44px; height: 44px; border-radius: var(--radius-md); background-color: ${color}20; color: ${color}; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; flex-shrink: 0;">
            ${window.Dashboard.getIconEmoji(h.icon)}
          </div>
          <div style="flex: 1; overflow: hidden; cursor: pointer;" onclick="Habits.openHabitDetails(${h.id})">
            <div style="font-size: 1rem; font-weight: 700; margin-bottom: 0.2rem;">${window.Dashboard.escapeHtml(h.name)}</div>
            <div style="display: flex; gap: 0.75rem; align-items: center; font-size: 0.8rem; color: var(--text-secondary); flex-wrap: wrap;">
              <span class="streak-tag">🔥 ${streak} day streak</span>
              <span>📊 ${rate}% completion</span>
              <span class="frequency-tag">• ${this.formatFrequency(h)}</span>
              ${h.category_name ? `<span>• ${window.Dashboard.escapeHtml(h.category_name)}</span>` : ''}
            </div>
          </div>
          <div style="display: flex; gap: 0.35rem; align-items: center;">
            <button class="action-dropdown-btn" onclick="Habits.openEditModal(${h.id})" title="Edit Habit">✎</button>
            ${this.renderStatusActions(h)}
            <button class="action-dropdown-btn" onclick="Habits.confirmDelete(${h.id})" title="Delete Habit" style="color: var(--accent-rose);">🗑</button>
          </div>
        </div>
      `;
    }).join('');
  },

  renderStatusActions(h) {
    if (h.status === 'active') {
      return `
        <button class="action-dropdown-btn" onclick="Habits.updateStatus(${h.id}, 'paused')" title="Pause habit">⏸</button>
        <button class="action-dropdown-btn" onclick="Habits.updateStatus(${h.id}, 'archived')" title="Archive habit">📦</button>
      `;
    } else if (h.status === 'paused') {
      return `
        <button class="action-dropdown-btn" onclick="Habits.updateStatus(${h.id}, 'active')" title="Resume habit" style="color: var(--accent-primary);">▶</button>
        <button class="action-dropdown-btn" onclick="Habits.updateStatus(${h.id}, 'archived')" title="Archive habit">📦</button>
      `;
    } else {
      return `
        <button class="action-dropdown-btn" onclick="Habits.updateStatus(${h.id}, 'active')" title="Restore habit" style="color: var(--accent-primary);">↺</button>
      `;
    }
  },

  formatFrequency(h) {
    if (h.frequency_type === 'daily') return 'Every day';
    if (h.frequency_type === 'weekdays') return 'Weekdays';
    if (h.frequency_type === 'weekends') return 'Weekends';
    if (h.frequency_days) {
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      return h.frequency_days.map(d => days[d]).join(', ');
    }
    return 'Custom';
  },

  openCreateModal() {
    this.editingHabitId = null;
    document.getElementById('habitModalTitle').textContent = "Create New Habit";
    document.getElementById('habitNameInput').value = "";
    document.getElementById('habitDescInput').value = "";
    document.getElementById('habitStartDate').value = new Date().toISOString().substring(0, 10);
    document.getElementById('habitGoalVal').value = "";
    document.getElementById('habitGoalUnit').value = "";
    document.getElementById('habitReminderEnabled').checked = false;
    document.getElementById('habitReminderTime').value = "20:00";
    document.getElementById('habitFreqSelect').value = "daily";

    this.selectedDays = [0, 1, 2, 3, 4, 5, 6];
    this.selectedIcon = 'target';
    this.selectedColor = '#10b981';

    this.renderPickers();
    this.onFrequencyChange('daily');
    this.populateCategoriesDropdown();

    document.getElementById('habitModal').classList.add('open');
  },

  async openEditModal(habitId) {
    this.editingHabitId = habitId;
    document.getElementById('habitModalTitle').textContent = "Edit Habit";

    const h = this.habitsList.find(x => x.id === habitId);
    if (!h) return;

    document.getElementById('habitNameInput').value = h.name || "";
    document.getElementById('habitDescInput').value = h.description || "";
    document.getElementById('habitStartDate').value = h.start_date || "";
    document.getElementById('habitGoalVal').value = h.goal_value || "";
    document.getElementById('habitGoalUnit').value = h.goal_unit || "";
    document.getElementById('habitReminderEnabled').checked = Boolean(h.reminder_enabled);
    document.getElementById('habitReminderTime').value = h.reminder_time || "20:00";
    document.getElementById('habitFreqSelect').value = h.frequency_type || "daily";

    this.selectedDays = h.frequency_days || [0, 1, 2, 3, 4, 5, 6];
    this.selectedIcon = h.icon || 'target';
    this.selectedColor = h.color || '#10b981';

    this.renderPickers();
    this.onFrequencyChange(h.frequency_type || 'daily');
    await this.populateCategoriesDropdown(h.category_id);

    document.getElementById('habitModal').classList.add('open');
  },

  async populateCategoriesDropdown(selectedId = null) {
    const sel = document.getElementById('habitCategorySelect');
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

  renderPickers() {
    // Icons
    const icons = ['target', 'dumbbell', 'book-open', 'heart-pulse', 'code', 'moon', 'droplet', 'smile', 'coffee', 'sun', 'apple', 'briefcase', 'wallet', 'feather', 'music', 'clock'];
    const iconGrid = document.getElementById('habitIconGrid');
    if (iconGrid) {
      iconGrid.innerHTML = icons.map(ic => `
        <div class="icon-swatch ${ic === this.selectedIcon ? 'selected' : ''}" onclick="Habits.selectIcon('${ic}')">
          ${window.Dashboard.getIconEmoji(ic)}
        </div>
      `).join('');
    }

    // Colors
    const colors = ['#10b981', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#ef4444', '#14b8a6'];
    const colorGrid = document.getElementById('habitColorGrid');
    if (colorGrid) {
      colorGrid.innerHTML = colors.map(co => `
        <div class="color-swatch ${co === this.selectedColor ? 'selected' : ''}" style="background-color: ${co};" onclick="Habits.selectColor('${co}')"></div>
      `).join('');
    }

    // Days selector
    this.updateDayButtons();
  },

  selectIcon(icon) {
    this.selectedIcon = icon;
    this.renderPickers();
  },

  selectColor(color) {
    this.selectedColor = color;
    this.renderPickers();
  },

  onFrequencyChange(freq) {
    const specificContainer = document.getElementById('habitSpecificDaysRow');
    if (specificContainer) {
      if (freq === 'specific_days' || freq === 'custom') {
        specificContainer.style.display = 'block';
      } else {
        specificContainer.style.display = 'none';
      }
    }
    if (freq === 'daily') this.selectedDays = [0, 1, 2, 3, 4, 5, 6];
    if (freq === 'weekdays') this.selectedDays = [0, 1, 2, 3, 4];
    if (freq === 'weekends') this.selectedDays = [5, 6];
    this.updateDayButtons();
  },

  toggleDay(dayIndex) {
    if (this.selectedDays.includes(dayIndex)) {
      if (this.selectedDays.length > 1) {
        this.selectedDays = this.selectedDays.filter(d => d !== dayIndex);
      }
    } else {
      this.selectedDays.push(dayIndex);
      this.selectedDays.sort();
    }
    this.updateDayButtons();
  },

  updateDayButtons() {
    document.querySelectorAll('.day-btn').forEach(btn => {
      const d = parseInt(btn.dataset.day, 10);
      btn.classList.toggle('selected', this.selectedDays.includes(d));
    });
  },

  async saveHabit() {
    const name = document.getElementById('habitNameInput').value.trim();
    if (!name) {
      Toast.error("Habit name is required.");
      return;
    }

    const payload = {
      name,
      description: document.getElementById('habitDescInput').value.trim(),
      icon: this.selectedIcon,
      color: this.selectedColor,
      category_id: document.getElementById('habitCategorySelect').value || null,
      frequency_type: document.getElementById('habitFreqSelect').value,
      frequency_days: this.selectedDays,
      start_date: document.getElementById('habitStartDate').value,
      goal_value: parseFloat(document.getElementById('habitGoalVal').value) || null,
      goal_unit: document.getElementById('habitGoalUnit').value.trim() || null,
      reminder_enabled: document.getElementById('habitReminderEnabled').checked,
      reminder_time: document.getElementById('habitReminderTime').value
    };

    try {
      if (this.editingHabitId) {
        await API.put(`/api/habits/${this.editingHabitId}`, payload);
        Toast.success("Habit updated!");
      } else {
        await API.post('/api/habits', payload);
        Toast.success("Habit created!");
      }

      document.getElementById('habitModal').classList.remove('open');
      await this.load();
      if (window.Dashboard) window.Dashboard.load();
    } catch (err) {
      Toast.error(err.message);
    }
  },

  async updateStatus(habitId, status) {
    try {
      await API.patch(`/api/habits/${habitId}/status`, { status });
      Toast.success(`Habit moved to ${status}.`);
      await this.load();
      if (window.Dashboard) window.Dashboard.load();
    } catch (err) {
      Toast.error(err.message);
    }
  },

  confirmDelete(habitId) {
    if (confirm("Are you sure you want to delete this habit? All associated completions will be removed.")) {
      this.deleteHabit(habitId);
    }
  },

  async deleteHabit(habitId) {
    try {
      await API.delete(`/api/habits/${habitId}`);
      Toast.success("Habit deleted.");
      await this.load();
      if (window.Dashboard) window.Dashboard.load();
    } catch (err) {
      Toast.error(err.message);
    }
  },

  async openHabitDetails(habitId) {
    try {
      const data = await API.get(`/api/habits/${habitId}`);
      const h = data.habit;
      const stats = h.stats || {};

      document.getElementById('habitDetailTitle').textContent = h.name;
      document.getElementById('habitDetailDesc').textContent = h.description || "No description provided.";
      document.getElementById('detailCurrentStreak').textContent = `🔥 ${stats.current_streak || 0} days`;
      document.getElementById('detailBestStreak').textContent = `🏆 ${stats.best_streak || 0} days`;
      document.getElementById('detailTotalCompletions').textContent = `✅ ${stats.total_completions || 0}`;
      document.getElementById('detailCompletionRate').textContent = `📊 ${stats.completion_rate || 0}%`;
      document.getElementById('detailMissedDays').textContent = `❌ ${stats.missed_days || 0} days`;

      // Render 90-Day Calendar Heatmap
      const heatmapContainer = document.getElementById('habitDetailHeatmap');
      if (heatmapContainer && h.history) {
        heatmapContainer.innerHTML = h.history.map(item => {
          let cls = 'heatmap-l0';
          let title = `${item.date}: Rest day`;
          if (item.scheduled) {
            if (item.completed) {
              cls = 'heatmap-l4';
              title = `${item.date}: Completed! 🎉`;
            } else {
              cls = 'dot-missed';
              title = `${item.date}: Missed`;
            }
          }
          return `<div class="heatmap-cell ${cls}" title="${title}"></div>`;
        }).join('');
      }

      document.getElementById('habitDetailModal').classList.add('open');
    } catch (err) {
      Toast.error("Failed to load habit details.");
    }
  }
};

window.Habits = Habits;
