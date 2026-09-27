/**
 * Calendar & History Controller
 * Monthly calendar grid with color-coded day indicators (🟢, 🟡, 🔴) and day inspection.
 */

const Calendar = {
  currentYear: new Date().getFullYear(),
  currentMonth: new Date().getMonth() + 1, // 1-12

  async load() {
    try {
      const data = await API.get(`/api/calendar/month?year=${this.currentYear}&month=${this.currentMonth}`);
      this.render(data);
    } catch (err) {
      console.error("Failed to load calendar month:", err);
    }
  },

  prevMonth() {
    this.currentMonth -= 1;
    if (this.currentMonth < 1) {
      this.currentMonth = 12;
      this.currentYear -= 1;
    }
    this.load();
  },

  nextMonth() {
    this.currentMonth += 1;
    if (this.currentMonth > 12) {
      this.currentMonth = 1;
      this.currentYear += 1;
    }
    this.load();
  },

  render(data) {
    const titleEl = document.getElementById('calMonthYearTitle');
    if (titleEl) {
      titleEl.textContent = `${data.month_name} ${data.year}`;
    }

    const grid = document.getElementById('calendarDaysGrid');
    if (!grid) return;

    grid.innerHTML = '';

    const days = data.days || [];
    if (days.length === 0) return;

    // Calculate empty padding cells before 1st day of month
    // weekday of day 1: 0=Mon, 6=Sun
    const firstWeekday = days[0].weekday;
    for (let i = 0; i < firstWeekday; i++) {
      const blank = document.createElement('div');
      blank.className = 'calendar-day-cell';
      blank.style.opacity = '0.15';
      blank.style.pointerEvents = 'none';
      grid.appendChild(blank);
    }

    // Render month days
    days.forEach(d => {
      const cell = document.createElement('div');
      cell.className = `calendar-day-cell ${d.is_today ? 'is-today' : ''} ${d.is_future ? 'is-future' : ''}`;

      let dotClass = 'dot-none';
      let statusTooltip = `${d.date}: Rest day`;

      if (d.status === 'completed') {
        dotClass = 'dot-completed';
        statusTooltip = `${d.date}: 100% completed (${d.habits_completed + d.tasks_completed}/${d.total_items})`;
      } else if (d.status === 'partial') {
        dotClass = 'dot-partial';
        statusTooltip = `${d.date}: ${d.percent}% completed`;
      } else if (d.status === 'missed') {
        dotClass = 'dot-missed';
        statusTooltip = `${d.date}: Missed`;
      }

      cell.title = statusTooltip;
      cell.innerHTML = `
        <span class="cal-day-num">${d.day}</span>
        <div class="cal-indicator-dot ${dotClass}"></div>
      `;

      if (!d.is_future) {
        cell.onclick = () => Calendar.inspectDay(d.date);
      }

      grid.appendChild(cell);
    });
  },

  async inspectDay(dateStr) {
    try {
      const data = await API.get(`/api/calendar/day?date=${dateStr}`);
      const sum = data.summary;

      document.getElementById('dayInspectTitle').textContent = data.formatted_date;
      document.getElementById('dayInspectPercent').textContent = `${sum.percent}%`;
      document.getElementById('dayInspectRatio').textContent = `${sum.completed_items} of ${sum.total_items} items completed`;

      // Habits breakdown
      const habitsList = document.getElementById('dayInspectHabits');
      if (habitsList) {
        if (sum.habits.length === 0) {
          habitsList.innerHTML = `<div style="font-size: 0.85rem; color: var(--text-muted);">No habits scheduled on this date.</div>`;
        } else {
          habitsList.innerHTML = sum.habits.map(h => `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.4rem 0; font-size: 0.9rem;">
              <span>${h.is_completed ? '✅' : '❌'} ${window.Dashboard.escapeHtml(h.name)}</span>
              <span style="font-size: 0.75rem; color: var(--text-muted);">${h.is_completed ? 'Completed' : 'Missed'}</span>
            </div>
          `).join('');
        }
      }

      // Tasks breakdown
      const tasksList = document.getElementById('dayInspectTasks');
      if (tasksList) {
        if (sum.tasks.length === 0) {
          tasksList.innerHTML = `<div style="font-size: 0.85rem; color: var(--text-muted);">No tasks on this date.</div>`;
        } else {
          tasksList.innerHTML = sum.tasks.map(t => `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.4rem 0; font-size: 0.9rem;">
              <span style="${t.completed ? 'text-decoration: line-through; color: var(--text-muted);' : ''}">
                ${t.completed ? '✅' : '☐'} ${window.Dashboard.escapeHtml(t.title)}
              </span>
              <span style="font-size: 0.75rem; color: var(--text-muted);">${t.completed ? 'Done' : 'Pending'}</span>
            </div>
          `).join('');
        }
      }

      document.getElementById('dayInspectModal').classList.add('open');
    } catch (err) {
      Toast.error("Failed to inspect date.");
    }
  }
};

window.Calendar = Calendar;
