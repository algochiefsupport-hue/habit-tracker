/**
 * Statistics & Insights Controller
 * Metrics overview, weekly performance bar graph, 60-day activity heatmap, and habit performance table.
 */

const Insights = {
  data: null,

  async load() {
    try {
      this.data = await API.get('/api/insights/summary');
      this.render();
    } catch (err) {
      console.error("Failed to load insights summary:", err);
    }
  },

  render() {
    if (!this.data) return;

    // Overview Metric Badges (Combined Habits + Tasks)
    document.getElementById('statTotalHabits').textContent = this.data.total_habits || 0;
    document.getElementById('statActiveHabits').textContent = this.data.active_habits || 0;
    document.getElementById('statTotalCompletions').textContent = this.data.total_completions || 0;
    document.getElementById('statCurrentStreak').textContent = `🔥 ${this.data.current_overall_streak || 0}d`;
    document.getElementById('statBestStreak').textContent = `🏆 ${this.data.best_overall_streak || 0}d`;
    document.getElementById('statAvgRate').textContent = `${this.data.average_completion_rate || 0}%`;

    // Tasks Performance Card
    const totalTasksEl = document.getElementById('statTotalTasks');
    const compTasksEl = document.getElementById('statCompletedTasks');
    const pendTasksEl = document.getElementById('statPendingTasks');
    const habitChecksEl = document.getElementById('statHabitCompletions');
    const taskRateBadge = document.getElementById('statTaskRateBadge');

    if (totalTasksEl) totalTasksEl.textContent = this.data.total_tasks || 0;
    if (compTasksEl) compTasksEl.textContent = this.data.completed_tasks || 0;
    if (pendTasksEl) pendTasksEl.textContent = this.data.pending_tasks || 0;
    if (habitChecksEl) habitChecksEl.textContent = this.data.habit_completions || 0;
    if (taskRateBadge) {
      taskRateBadge.textContent = `${this.data.task_completion_rate || 0}% Done`;
      if (this.data.task_completion_rate >= 80) {
        taskRateBadge.className = 'priority-pill priority-low';
        taskRateBadge.style.color = 'var(--accent-primary)';
      } else if (this.data.task_completion_rate >= 50) {
        taskRateBadge.className = 'priority-pill priority-medium';
      } else {
        taskRateBadge.className = 'priority-pill priority-high';
      }
    }

    // Render Weekly Bar Graph (Last 7 Days)
    const weeklyContainer = document.getElementById('insightsWeeklyBars');
    if (weeklyContainer && this.data.weekly_progress) {
      weeklyContainer.innerHTML = this.data.weekly_progress.map(day => `
        <div class="chart-bar-col" title="${day.day_full}: ${day.percent}% (${day.completed_items}/${day.total_items})">
          <div class="bar-val">${day.percent}%</div>
          <div class="bar-track">
            <div class="bar-fill" style="height: ${Math.max(4, day.percent)}%;"></div>
          </div>
          <div class="bar-label">${day.day_name}</div>
        </div>
      `).join('');
    }

    // Render 60-Day Activity Heatmap Grid
    const heatmapContainer = document.getElementById('insightsHeatmapGrid');
    if (heatmapContainer && this.data.heatmap) {
      heatmapContainer.innerHTML = this.data.heatmap.map(c => `
        <div class="heatmap-cell heatmap-l${c.level}"
             title="${c.date}: ${c.percent}% completed (${c.completed}/${c.total})"></div>
      `).join('');
    }

    // Render Habit Performance List
    const perfContainer = document.getElementById('habitPerformanceList');
    if (perfContainer && this.data.habit_performance) {
      if (this.data.habit_performance.length === 0) {
        perfContainer.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No habits tracked yet.</div>`;
      } else {
        perfContainer.innerHTML = this.data.habit_performance.map(h => `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.85rem 0; border-bottom: 1px solid var(--border-color);">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <span style="font-size: 1.25rem;">${window.Dashboard.getIconEmoji(h.icon)}</span>
              <div>
                <div style="font-weight: 600; font-size: 0.95rem;">${window.Dashboard.escapeHtml(h.name)}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">${h.category_name || 'General'} • ${h.status}</div>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 1.25rem; font-size: 0.85rem;">
              <span class="streak-tag">🔥 ${h.current_streak}d</span>
              <span style="font-weight: 600; color: var(--accent-primary); min-width: 50px; text-align: right;">${h.completion_rate}%</span>
              <span style="color: var(--text-secondary); min-width: 60px; text-align: right;">${h.total_completions} checks</span>
            </div>
          </div>
        `).join('');
      }
    }
  }
};

window.Insights = Insights;
