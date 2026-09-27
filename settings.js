/**
 * User Settings, Preferences, Theme, and Data Backup/Restore Controller
 */

const Settings = {
  data: null,

  async load() {
    try {
      this.data = await API.get('/api/settings');
      this.render();
    } catch (err) {
      console.error("Failed to load settings:", err);
    }
  },

  render() {
    if (!this.data) return;
    const user = this.data.user || {};
    const settings = this.data.settings || {};

    // Account inputs
    document.getElementById('settingsUserName').value = user.name || '';
    document.getElementById('settingsUserEmail').value = user.email || '';

    // Notifications
    document.getElementById('setDailyPlanToggle').checked = Boolean(settings.daily_planning_enabled);
    document.getElementById('setDailyPlanTime').value = settings.daily_planning_time || '21:00';
    document.getElementById('setHabitReminders').checked = Boolean(settings.habit_reminders_enabled);
    document.getElementById('setTaskReminders').checked = Boolean(settings.task_reminders_enabled);
    document.getElementById('setSoundChime').checked = Boolean(settings.sound_enabled);

    // Appearance Theme
    const currentTheme = settings.theme || 'system';
    document.querySelectorAll('input[name="themeChoice"]').forEach(radio => {
      radio.checked = (radio.value === currentTheme);
    });

    // Preferences
    document.getElementById('setStartOfWeek').value = settings.start_of_week || 'monday';
    document.getElementById('setTimeFormat').value = settings.time_format || '12h';
    document.getElementById('setStreakFreeze').checked = Boolean(settings.streak_freeze_enabled);
  },

  async saveSettings() {
    const name = document.getElementById('settingsUserName').value.trim();
    const themeChoice = document.querySelector('input[name="themeChoice"]:checked')?.value || 'system';

    const payload = {
      name,
      theme: themeChoice,
      start_of_week: document.getElementById('setStartOfWeek').value,
      time_format: document.getElementById('setTimeFormat').value,
      daily_planning_enabled: document.getElementById('setDailyPlanToggle').checked,
      daily_planning_time: document.getElementById('setDailyPlanTime').value,
      habit_reminders_enabled: document.getElementById('setHabitReminders').checked,
      task_reminders_enabled: document.getElementById('setTaskReminders').checked,
      sound_enabled: document.getElementById('setSoundChime').checked,
      streak_freeze_enabled: document.getElementById('setStreakFreeze').checked,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    };

    try {
      const res = await API.put('/api/settings', payload);
      Toast.success(res.message);

      // Apply theme immediately
      this.applyTheme(payload.theme);
      localStorage.setItem('sound_enabled', payload.sound_enabled ? '1' : '0');

      if (window.App) {
        window.App.settings = res.settings;
        window.App.updateUserProfile(name);
      }
    } catch (err) {
      Toast.error(err.message);
    }
  },

  applyTheme(theme) {
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  },

  async handleChangePassword(e) {
    e.preventDefault();
    const current_password = document.getElementById('currPasswordInput').value;
    const new_password = document.getElementById('newPasswordInput').value;

    try {
      const res = await API.put('/api/auth/password', { current_password, new_password });
      Toast.success(res.message);
      document.getElementById('currPasswordInput').value = '';
      document.getElementById('newPasswordInput').value = '';
    } catch (err) {
      Toast.error(err.message);
    }
  },

  async confirmDeleteAccount() {
    const confirmation = prompt("Type 'DELETE' in uppercase to permanently delete your account and all data:");
    if (confirmation === 'DELETE') {
      try {
        await API.delete('/api/auth/account');
        Toast.info("Account permanently deleted.");
        API.setToken(null);
        window.location.reload();
      } catch (err) {
        Toast.error(err.message);
      }
    } else if (confirmation !== null) {
      Toast.error("Confirmation string did not match. Account was not deleted.");
    }
  },

  async exportData() {
    try {
      const token = API.getToken();
      const response = await fetch('/api/data/export', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `habit_tracker_backup_${new Date().toISOString().substring(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      Toast.success("Data backup downloaded!");
    } catch (err) {
      Toast.error(err.message);
    }
  },

  triggerImport() {
    const fileInput = document.getElementById('importDataFile');
    if (fileInput) fileInput.click();
  },

  async handleFileImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target.result);
        const res = await API.post('/api/data/import', json);
        Toast.success(res.message);
        setTimeout(() => window.location.reload(), 1000);
      } catch (err) {
        Toast.error("Invalid JSON backup file or import error.");
      }
    };
    reader.readAsText(file);
  },

  async resetAllData() {
    if (confirm("Are you sure? This will remove all habits, completions, tasks, and goals! Your user login will remain.")) {
      try {
        const res = await API.post('/api/data/reset', {});
        Toast.success(res.message);
        setTimeout(() => window.location.reload(), 800);
      } catch (err) {
        Toast.error(err.message);
      }
    }
  }
};

window.Settings = Settings;
