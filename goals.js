/**
 * Goals Management Controller
 */

const Goals = {
  goalsList: [],
  editingGoalId: null,

  async load() {
    try {
      const data = await API.get('/api/goals');
      this.goalsList = data.goals || [];
      this.render();
    } catch (err) {
      console.error("Failed to load goals:", err);
    }
  },

  render() {
    const container = document.getElementById('goalsListContainer');
    if (!container) return;

    if (this.goalsList.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🎯</div>
          <div class="empty-title">No goals created yet</div>
          <div class="empty-sub">Set long-term targets (e.g., "Read 20 books this year") to stay motivated.</div>
          <button class="btn-primary-quick" onclick="Goals.openCreateModal()" style="border-radius: var(--radius-md);">
            <span>+ Create Goal</span>
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = this.goalsList.map(g => {
      const percent = g.percent || 0;
      const isCompleted = g.status === 'completed' || percent >= 100;

      return `
        <div class="card" style="margin-bottom: 1rem; position: relative;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
            <div>
              <div style="font-size: 1.05rem; font-weight: 700;">${window.Dashboard.escapeHtml(g.title)}</div>
              ${g.description ? `<div style="font-size: 0.825rem; color: var(--text-secondary); margin-top: 0.2rem;">${window.Dashboard.escapeHtml(g.description)}</div>` : ''}
              ${g.category_name ? `<span style="font-size: 0.75rem; color: var(--accent-indigo); font-weight: 600; margin-top: 0.25rem; display: inline-block;">📁 ${window.Dashboard.escapeHtml(g.category_name)}</span>` : ''}
            </div>
            <div style="display: flex; align-items: center; gap: 0.35rem;">
              <button class="action-dropdown-btn" onclick="Goals.openEditModal(${g.id})" title="Edit goal">✎</button>
              <button class="action-dropdown-btn" onclick="Goals.deleteGoal(${g.id})" title="Delete goal" style="color: var(--accent-rose);">🗑</button>
            </div>
          </div>

          <!-- Progress Bar -->
          <div style="margin-bottom: 0.75rem;">
            <div style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 600; margin-bottom: 0.35rem;">
              <span>Progress: ${g.current_value} / ${g.target_value} ${g.unit}</span>
              <span style="color: var(--accent-primary);">${percent}%</span>
            </div>
            <div style="height: 10px; width: 100%; background-color: var(--bg-surface-hover); border-radius: var(--radius-full); overflow: hidden;">
              <div style="height: 100%; width: ${percent}%; background: linear-gradient(90deg, var(--accent-primary), #059669); border-radius: var(--radius-full); transition: width 0.4s ease;"></div>
            </div>
          </div>

          <!-- Quick Increment Buttons -->
          <div style="display: flex; justify-content: flex-end; gap: 0.5rem; align-items: center;">
            <button class="btn-secondary" style="padding: 0.3rem 0.65rem; font-size: 0.8rem;" onclick="Goals.updateProgress(${g.id}, -1)">- 1</button>
            <button class="btn-secondary" style="padding: 0.3rem 0.65rem; font-size: 0.8rem;" onclick="Goals.updateProgress(${g.id}, 1)">+ 1</button>
            <button class="btn-secondary" style="padding: 0.3rem 0.65rem; font-size: 0.8rem;" onclick="Goals.promptCustomProgress(${g.id}, ${g.current_value})">Set Value</button>
          </div>
        </div>
      `;
    }).join('');
  },

  openCreateModal() {
    this.editingGoalId = null;
    document.getElementById('goalModalTitle').textContent = "Create Goal";
    document.getElementById('goalTitleInput').value = "";
    document.getElementById('goalDescInput').value = "";
    document.getElementById('goalTargetVal').value = "10";
    document.getElementById('goalCurrentVal').value = "0";
    document.getElementById('goalUnitInput').value = "times";
    document.getElementById('goalStartDate').value = new Date().toISOString().substring(0, 10);
    document.getElementById('goalEndDate').value = "";

    this.populateCategories();
    document.getElementById('goalModal').classList.add('open');
  },

  async openEditModal(goalId) {
    this.editingGoalId = goalId;
    document.getElementById('goalModalTitle').textContent = "Edit Goal";

    const g = this.goalsList.find(x => x.id === goalId);
    if (!g) return;

    document.getElementById('goalTitleInput').value = g.title || "";
    document.getElementById('goalDescInput').value = g.description || "";
    document.getElementById('goalTargetVal').value = g.target_value || "10";
    document.getElementById('goalCurrentVal').value = g.current_value || "0";
    document.getElementById('goalUnitInput').value = g.unit || "times";
    document.getElementById('goalStartDate').value = g.start_date || "";
    document.getElementById('goalEndDate').value = g.end_date || "";

    await this.populateCategories(g.category_id);
    document.getElementById('goalModal').classList.add('open');
  },

  async populateCategories(selectedId = null) {
    const sel = document.getElementById('goalCategorySelect');
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

  async saveGoal() {
    const title = document.getElementById('goalTitleInput').value.trim();
    if (!title) {
      Toast.error("Goal title is required.");
      return;
    }

    const payload = {
      title,
      description: document.getElementById('goalDescInput').value.trim(),
      target_value: parseFloat(document.getElementById('goalTargetVal').value) || 1.0,
      current_value: parseFloat(document.getElementById('goalCurrentVal').value) || 0.0,
      unit: document.getElementById('goalUnitInput').value.trim() || 'times',
      start_date: document.getElementById('goalStartDate').value || null,
      end_date: document.getElementById('goalEndDate').value || null,
      category_id: document.getElementById('goalCategorySelect').value || null
    };

    try {
      if (this.editingGoalId) {
        await API.put(`/api/goals/${this.editingGoalId}`, payload);
        Toast.success("Goal updated!");
      } else {
        await API.post('/api/goals', payload);
        Toast.success("Goal created!");
      }

      document.getElementById('goalModal').classList.remove('open');
      await this.load();
    } catch (err) {
      Toast.error(err.message);
    }
  },

  async updateProgress(goalId, delta) {
    try {
      const res = await API.patch(`/api/goals/${goalId}/progress`, { delta });
      Toast.success(res.message);
      await this.load();
    } catch (err) {
      Toast.error(err.message);
    }
  },

  async promptCustomProgress(goalId, currentVal) {
    const newVal = prompt("Enter new current value:", currentVal);
    if (newVal === null) return;
    const parsed = parseFloat(newVal);
    if (isNaN(parsed)) return;

    try {
      const res = await API.patch(`/api/goals/${goalId}/progress`, { current_value: parsed });
      Toast.success(res.message);
      await this.load();
    } catch (err) {
      Toast.error(err.message);
    }
  },

  async deleteGoal(goalId) {
    if (!confirm("Are you sure you want to delete this goal?")) return;
    try {
      await API.delete(`/api/goals/${goalId}`);
      Toast.success("Goal deleted.");
      await this.load();
    } catch (err) {
      Toast.error(err.message);
    }
  }
};

window.Goals = Goals;
