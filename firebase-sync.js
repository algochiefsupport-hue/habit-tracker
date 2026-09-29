/**
 * HabitPulse Firebase Cloud Sync Engine
 * Enables Real-time Google Cloud Backup & Multi-device restore.
 * Works seamlessly with Offline-First LocalStorage architecture.
 */

const FirebaseSync = {
  db: null,
  isInitialized: false,
  syncTimeout: null,
  syncStatus: 'offline', // 'synced', 'syncing', 'error', 'offline', 'unconfigured'

  // Saved or default config
  getConfig() {
    try {
      const saved = localStorage.getItem('habit_firebase_config');
      if (saved) return JSON.parse(saved);
    } catch (e) {}

    // Pre-configured official Firebase project
    return {
      apiKey: "AIzaSyBxM3UGqEvKgJO3j4zXBtl2XaOkDIb2sZw",
      authDomain: "habit-tracker-194d8.firebaseapp.com",
      projectId: "habit-tracker-194d8",
      storageBucket: "habit-tracker-194d8.firebasestorage.app",
      messagingSenderId: "77409038824",
      appId: "1:77409038824:web:371e808032d849f366f45d",
      measurementId: "G-Y675563YZ8"
    };
  },

  saveConfig(config) {
    if (!config || !config.apiKey) return false;
    localStorage.setItem('habit_firebase_config', JSON.stringify(config));
    return this.init(true);
  },

  isConfigured() {
    const cfg = this.getConfig();
    return !!(cfg && cfg.apiKey && cfg.projectId);
  },

  init(forceReinit = false) {
    const config = this.getConfig();
    if (!this.isConfigured()) {
      this.syncStatus = 'unconfigured';
      this.updateStatusUI();
      return false;
    }

    if (typeof firebase === 'undefined') {
      console.warn('[FirebaseSync] Firebase SDK not yet loaded, offline mode active.');
      this.syncStatus = 'offline';
      this.updateStatusUI();
      return false;
    }

    try {
      if (!firebase.apps.length || forceReinit) {
        if (firebase.apps.length && forceReinit) {
          firebase.app().delete();
        }
        firebase.initializeApp(config);
      }
      this.db = firebase.firestore();
      this.isInitialized = true;
      this.syncStatus = 'synced';
      this.updateStatusUI();
      console.log('✓ Firebase Cloud Database Connected successfully!');

      // Listen for network changes
      window.addEventListener('online', () => {
        this.scheduleSync(500);
      });

      return true;
    } catch (err) {
      console.error('[FirebaseSync] Initialization error:', err);
      this.syncStatus = 'error';
      this.updateStatusUI();
      return false;
    }
  },

  // Push local device data to Google Cloud (Firestore)
  async syncToCloud() {
    if (!this.isInitialized && !this.init()) return;
    if (!navigator.onLine) {
      this.syncStatus = 'offline';
      this.updateStatusUI();
      return;
    }

    const currentUser = window.MockBackend ? window.MockBackend.getCurrentUser() : null;
    if (!currentUser || !currentUser.email) return;

    this.syncStatus = 'syncing';
    this.updateStatusUI();

    const userEmail = currentUser.email.toLowerCase().trim();
    const dataToSync = {
      user: {
        id: currentUser.id,
        name: currentUser.name,
        email: userEmail
      },
      habits: window.MockBackend.get('habits') || [],
      tasks: window.MockBackend.get('tasks') || [],
      goals: window.MockBackend.get('goals') || [],
      completions: window.MockBackend.get('completions') || [],
      categories: window.MockBackend.get('categories') || [],
      settings: window.MockBackend.get('settings') || {},
      last_synced: new Date().toISOString()
    };

    try {
      await this.db.collection('habit_pulse_users').doc(userEmail).set(dataToSync, { merge: true });
      this.syncStatus = 'synced';
      this.updateStatusUI();
      console.log('✓ Cloud Sync complete: All habits & tasks saved to Google Cloud!');
    } catch (err) {
      console.warn('[FirebaseSync] Cloud sync upload warning:', err);
      this.syncStatus = 'error';
      this.updateStatusUI();
    }
  },

  // Download user data from Google Cloud (Firestore) on New Device Login
  async syncFromCloud(email) {
    if (!this.isInitialized && !this.init()) return false;
    if (!email) return false;

    const userEmail = email.toLowerCase().trim();
    this.syncStatus = 'syncing';
    this.updateStatusUI();

    try {
      const doc = await this.db.collection('habit_pulse_users').doc(userEmail).get();
      if (doc.exists) {
        const cloudData = doc.data();
        console.log('✓ Found Cloud backup for user:', userEmail);

        if (cloudData.habits && Array.isArray(cloudData.habits)) {
          window.MockBackend.set('habits', cloudData.habits);
        }
        if (cloudData.tasks && Array.isArray(cloudData.tasks)) {
          window.MockBackend.set('tasks', cloudData.tasks);
        }
        if (cloudData.goals && Array.isArray(cloudData.goals)) {
          window.MockBackend.set('goals', cloudData.goals);
        }
        if (cloudData.completions && Array.isArray(cloudData.completions)) {
          window.MockBackend.set('completions', cloudData.completions);
        }
        if (cloudData.categories && Array.isArray(cloudData.categories)) {
          window.MockBackend.set('categories', cloudData.categories);
        }
        if (cloudData.settings) {
          window.MockBackend.set('settings', cloudData.settings);
        }

        // Add user to users list if missing
        const users = window.MockBackend.get('users') || [];
        if (!users.find(u => u.email.toLowerCase() === userEmail)) {
          users.push(cloudData.user || { id: Date.now(), name: userEmail.split('@')[0], email: userEmail });
          window.MockBackend.set('users', users);
        }

        this.syncStatus = 'synced';
        this.updateStatusUI();

        if (window.Toast) {
          Toast.success("☁️ Google Cloud Data Restored! Welcome back!");
        }

        // Re-render views
        if (window.App) {
          window.App.switchView(window.App.currentView || 'dashboard');
        }
        return true;
      } else {
        console.log('No cloud backup found yet for:', userEmail, '- Initializing new cloud copy.');
        await this.syncToCloud();
        return false;
      }
    } catch (err) {
      console.warn('[FirebaseSync] Could not pull from cloud:', err);
      this.syncStatus = 'error';
      this.updateStatusUI();
      return false;
    }
  },

  // Debounced auto-sync trigger
  scheduleSync(delay = 1500) {
    if (!this.isConfigured()) return;
    if (this.syncTimeout) clearTimeout(this.syncTimeout);
    this.syncTimeout = setTimeout(() => {
      this.syncToCloud();
    }, delay);
  },

  updateStatusUI() {
    const badge = document.getElementById('cloudSyncStatusBadge');
    if (!badge) return;

    if (!this.isConfigured()) {
      badge.innerHTML = `<span style="display: inline-flex; align-items: center; gap: 0.35rem; color: var(--text-muted); font-size: 0.75rem;"><span style="width: 8px; height: 8px; border-radius: 50%; background: #94a3b8;"></span>Device Storage Only</span>`;
      return;
    }

    if (this.syncStatus === 'synced') {
      badge.innerHTML = `<span style="display: inline-flex; align-items: center; gap: 0.35rem; color: #10b981; font-size: 0.75rem;"><span style="width: 8px; height: 8px; border-radius: 50%; background: #10b981;"></span>☁️ Cloud Synced</span>`;
    } else if (this.syncStatus === 'syncing') {
      badge.innerHTML = `<span style="display: inline-flex; align-items: center; gap: 0.35rem; color: #f59e0b; font-size: 0.75rem;"><span style="width: 8px; height: 8px; border-radius: 50%; background: #f59e0b;"></span>🔄 Syncing...</span>`;
    } else if (this.syncStatus === 'offline') {
      badge.innerHTML = `<span style="display: inline-flex; align-items: center; gap: 0.35rem; color: #3b82f6; font-size: 0.75rem;"><span style="width: 8px; height: 8px; border-radius: 50%; background: #3b82f6;"></span>⚡ Offline (Device Saved)</span>`;
    } else {
      badge.innerHTML = `<span style="display: inline-flex; align-items: center; gap: 0.35rem; color: #f43f5e; font-size: 0.75rem;"><span style="width: 8px; height: 8px; border-radius: 50%; background: #f43f5e;"></span>⚠️ Cloud Sync Error</span>`;
    }
  }
};

window.FirebaseSync = FirebaseSync;

// Auto-init on load
window.addEventListener('load', () => {
  setTimeout(() => {
    FirebaseSync.init();
  }, 1000);
});
