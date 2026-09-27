/**
 * Main Application Orchestrator & View Router
 */

const App = {
  currentUser: null,
  settings: null,
  currentView: 'dashboard',

  async init() {
    this.bindEvents();
    if (window.NotificationManager) {
      window.NotificationManager.init();
    }
    await this.initSession();
  },

  async initSession() {
    try {
      const data = await API.get('/api/auth/me');
      this.currentUser = data.user;
      this.settings = data.settings;

      this.updateUserProfile(this.currentUser.name, this.currentUser.email);
      this.applySavedTheme(this.settings.theme);

      // Check onboarding
      if (this.settings.onboarding_completed === 0 && window.Onboarding) {
        window.Onboarding.start();
      }

      this.switchView(this.currentView || 'dashboard');
    } catch (err) {
      // Not logged in or expired session -> prompt auth modal
      this.currentUser = null;
      if (window.Auth) {
        window.Auth.showAuthModal('login');
      }
    }
  },

  updateUserProfile(name, email) {
    const avatarEl = document.getElementById('sidebarAvatar');
    const nameEl = document.getElementById('sidebarUserName');
    const emailEl = document.getElementById('sidebarUserEmail');

    if (avatarEl && name) {
      avatarEl.textContent = name.charAt(0).toUpperCase();
    }
    if (nameEl && name) {
      nameEl.textContent = name;
    }
    if (emailEl && email) {
      emailEl.textContent = email;
    }
  },

  applySavedTheme(theme) {
    if (!theme || theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  },

  toggleThemeQuick() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);

    // Save to settings if logged in
    if (this.currentUser) {
      API.put('/api/settings', { theme: next }).catch(() => {});
    }
  },

  switchView(viewName) {
    this.currentView = viewName;

    // Hide all view sections
    document.querySelectorAll('.view-section').forEach(sec => {
      sec.classList.remove('active-view');
    });

    // Show target section
    const target = document.getElementById(`view-${viewName}`);
    if (target) {
      target.classList.add('active-view');
    }

    // Update navigation active links
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.toggle('active', link.dataset.view === viewName);
    });

    document.querySelectorAll('.bottom-nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === viewName);
    });

    // Update topbar title
    const titles = {
      'dashboard': "Today's Focus",
      'habits': "Habits Management",
      'tasks': "Daily Tasks Planner",
      'tomorrow': "Plan Tomorrow",
      'calendar': "History & Calendar",
      'insights': "Progress & Insights",
      'goals': "Long-term Goals",
      'settings': "Settings & Preferences"
    };
    const titleEl = document.getElementById('topbarPageTitle');
    if (titleEl) {
      titleEl.textContent = titles[viewName] || "Habit Tracker";
    }

    // Close mobile sidebar if open
    this.closeMobileSidebar();
    this.closeFabMenu();

    // Trigger view-specific data loaders
    if (viewName === 'dashboard' && window.Dashboard) window.Dashboard.load();
    if (viewName === 'habits' && window.Habits) window.Habits.load();
    if (viewName === 'tasks' && window.Tasks) window.Tasks.load();
    if (viewName === 'tomorrow' && window.Tomorrow) window.Tomorrow.load();
    if (viewName === 'calendar' && window.Calendar) window.Calendar.load();
    if (viewName === 'insights' && window.Insights) window.Insights.load();
    if (viewName === 'goals' && window.Goals) window.Goals.load();
    if (viewName === 'settings' && window.Settings) window.Settings.load();

    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  toggleMobileSidebar() {
    const sidebar = document.getElementById('appSidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (sidebar) sidebar.classList.toggle('mobile-open');
    if (backdrop) backdrop.classList.toggle('active');
  },

  closeMobileSidebar() {
    const sidebar = document.getElementById('appSidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (sidebar) sidebar.classList.remove('mobile-open');
    if (backdrop) backdrop.classList.remove('active');
  },

  toggleFabMenu() {
    const menu = document.getElementById('fabMenu');
    const fab = document.getElementById('fabQuickAdd');
    if (menu) menu.classList.toggle('open');
    if (fab) fab.classList.toggle('open');
  },

  closeFabMenu() {
    const menu = document.getElementById('fabMenu');
    const fab = document.getElementById('fabQuickAdd');
    if (menu) menu.classList.remove('open');
    if (fab) fab.classList.remove('open');
  },

  bindEvents() {
    // Nav links
    document.querySelectorAll('.nav-link, .bottom-nav-item').forEach(el => {
      el.addEventListener('click', (e) => {
        const view = el.dataset.view;
        if (view) {
          e.preventDefault();
          this.switchView(view);
        }
      });
    });

    // Close modal on click outside
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.classList.remove('open');
        }
      });
    });

    // Keyboard navigation: Escape key closes modals and menus
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
        this.closeMobileSidebar();
        this.closeFabMenu();
      }
    });
  }
};

window.App = App;

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
