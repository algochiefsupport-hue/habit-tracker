/**
 * Notifications & Reminders Engine
 * Handles Web Notifications API, Permission Explainers, and Reminder Check loop.
 */

const NotificationManager = {
  firedReminders: new Set(),
  inAppAlerts: [],

  init() {
    this.startReminderLoop();
  },

  async requestPermissionWithContext() {
    if (!('Notification' in window)) {
      Toast.error("Notifications are not supported in this browser.");
      return;
    }

    if (Notification.permission === 'granted') {
      Toast.info("Notifications are already enabled!");
      return;
    }

    if (Notification.permission === 'denied') {
      Toast.error("Notifications are blocked in your browser settings. Please enable them manually.");
      return;
    }

    // Open polite contextual explainer modal
    const modal = document.getElementById('notificationPermissionModal');
    if (modal) {
      modal.classList.add('open');
    } else {
      // Direct request fallback
      this.promptNativePermission();
    }
  },

  async promptNativePermission() {
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        Toast.success("Notifications enabled! You'll receive gentle daily reminders.");
        this.sendNotification("Habit Tracker", {
          body: "Notifications are active. We'll help you stay consistent!",
          icon: "static/icons/logo.png"
        });
      } else {
        Toast.info("Notifications were declined. The app will continue working normally.");
      }
    } catch (e) {
      console.warn("Notification permission error:", e);
    }
    const modal = document.getElementById('notificationPermissionModal');
    if (modal) modal.classList.remove('open');
  },

  sendNotification(title, options = {}) {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          icon: 'static/icons/logo.png',
          badge: 'static/icons/badge.png',
          ...options
        });
      } catch (e) {
        console.warn("Could not dispatch native notification:", e);
      }
    }

    // In-app alert fallback / log
    this.addInAppAlert(title, options.body || '');
    Toast.info(`🔔 ${title}: ${options.body || ''}`);
    if (window.SoundManager) {
      window.SoundManager.playCompletionChime();
    }
  },

  addInAppAlert(title, body) {
    this.inAppAlerts.unshift({
      title,
      body,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    this.updateNotificationBadge();
  },

  updateNotificationBadge() {
    const badge = document.getElementById('topbarNotifBadge');
    if (badge) {
      if (this.inAppAlerts.length > 0) {
        badge.style.display = 'block';
      } else {
        badge.style.display = 'none';
      }
    }
  },

  startReminderLoop() {
    // Check every 30 seconds
    setInterval(() => {
      this.checkReminders();
    }, 30000);
    this.checkReminders();
  },

  async checkReminders() {
    if (!window.App || !window.App.currentUser) return;

    const now = new Date();
    const currentHHMM = now.toTimeString().substring(0, 5); // "HH:MM"
    const todayStr = now.toISOString().substring(0, 10);
    const keyPrefix = `${todayStr}_${currentHHMM}`;

    const settings = window.App.settings || {};

    // 1. Daily Planning Reminder
    if (settings.daily_planning_enabled && settings.daily_planning_time === currentHHMM) {
      const planKey = `${keyPrefix}_daily_plan`;
      if (!this.firedReminders.has(planKey)) {
        this.firedReminders.add(planKey);
        this.sendNotification("Plan Tomorrow 📝", {
          body: "Take 2 minutes to decide what you want to accomplish tomorrow."
        });
      }
    }

    // 2. Habit Reminders
    if (settings.habit_reminders_enabled && window.Dashboard && window.Dashboard.todayHabits) {
      window.Dashboard.todayHabits.forEach(h => {
        if (h.reminder_enabled && h.reminder_time === currentHHMM && !h.is_completed) {
          const habitKey = `${keyPrefix}_habit_${h.id}`;
          if (!this.firedReminders.has(habitKey)) {
            this.firedReminders.add(habitKey);
            this.sendNotification(`Habit Reminder: ${h.name} 💪`, {
              body: `It's time for your ${h.name}. Keep your streak alive!`
            });
          }
        }
      });
    }

    // 3. Task Reminders
    if (settings.task_reminders_enabled && window.Dashboard && window.Dashboard.todayTasks) {
      window.Dashboard.todayTasks.forEach(t => {
        if (t.reminder_enabled && t.reminder_time === currentHHMM && !t.completed) {
          const taskKey = `${keyPrefix}_task_${t.id}`;
          if (!this.firedReminders.has(taskKey)) {
            this.firedReminders.add(taskKey);
            this.sendNotification(`Upcoming Task: ${t.title} 📋`, {
              body: `Scheduled for ${t.time || currentHHMM}. Let's get it done!`
            });
          }
        }
      });
    }
  }
};

window.NotificationManager = NotificationManager;
