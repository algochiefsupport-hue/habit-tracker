/**
 * API Client & Toast Notification System
 * Supports both Live Python/Flask backend and Static/GitHub Pages LocalStorage Mode.
 */

// ==========================================
// In-Browser LocalStorage Mock Backend
// (Used when hosted on GitHub Pages, offline, or file:// protocol)
// ==========================================
const MockBackend = {
  get(table) {
    try {
      const data = localStorage.getItem('mock_db_' + table);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  },

  set(table, val) {
    try {
      localStorage.setItem('mock_db_' + table, JSON.stringify(val));
    } catch (e) {
      console.warn("Storage quota exceeded or error:", e);
    }
  },

  init() {
    // 1. Seed Users (Include pre-registered user Aman & demo Alex)
    if (!this.get('users') || !Array.isArray(this.get('users')) || this.get('users').length === 0) {
      this.set('users', [
        {
          id: 20,
          name: 'aman',
          email: 'aa2359110@gmail.com',
          password: '123456789',
          created_at: new Date().toISOString()
        },
        {
          id: 1,
          name: 'Alex Morgan',
          email: 'alex@habitpulse.com',
          password: 'password123',
          created_at: new Date().toISOString()
        }
      ]);
    }

    // 2. Seed Categories
    if (!this.get('categories')) {
      this.set('categories', [
        { id: 1, name: 'Health & Fitness', icon: 'heart', color: '#10b981' },
        { id: 2, name: 'Focus & Learning', icon: 'book', color: '#6366f1' },
        { id: 3, name: 'Mindfulness & Spirit', icon: 'sun', color: '#f59e0b' },
        { id: 4, name: 'Work & Productivity', icon: 'briefcase', color: '#3b82f6' },
        { id: 5, name: 'Personal Growth', icon: 'star', color: '#ec4899' }
      ]);
    }

    // 3. Seed Settings
    if (!this.get('settings')) {
      this.set('settings', {
        theme: 'system',
        start_of_week: 'monday',
        time_format: '12h',
        date_format: 'YYYY-MM-DD',
        daily_planning_enabled: 1,
        daily_planning_time: '21:00',
        habit_reminders_enabled: 1,
        task_reminders_enabled: 1,
        sound_enabled: 1,
        streak_freeze_enabled: 1,
        timezone: 'UTC',
        onboarding_completed: 1
      });
    }

    // 4. Seed Habits
    if (!this.get('habits')) {
      this.set('habits', [
        {
          id: 13,
          user_id: 20,
          category_id: 3,
          name: 'Fajr',
          description: 'Daily morning prayer & reflection',
          icon: 'target',
          color: '#10b981',
          frequency_type: 'daily',
          frequency_days: [0, 1, 2, 3, 4, 5, 6],
          start_date: '2026-09-01',
          goal_value: null,
          goal_unit: null,
          reminder_enabled: 0,
          reminder_time: '05:00',
          status: 'active'
        },
        {
          id: 14,
          user_id: 20,
          category_id: 1,
          name: 'Morning Walk 20m',
          description: 'Brisk walk outdoor in sunlight',
          icon: 'activity',
          color: '#3b82f6',
          frequency_type: 'daily',
          frequency_days: [0, 1, 2, 3, 4, 5, 6],
          start_date: '2026-09-01',
          goal_value: null,
          goal_unit: null,
          reminder_enabled: 1,
          reminder_time: '07:00',
          status: 'active'
        },
        {
          id: 15,
          user_id: 20,
          category_id: 2,
          name: 'Read 10 Pages',
          description: 'Self-improvement / strategy book',
          icon: 'book',
          color: '#6366f1',
          frequency_type: 'daily',
          frequency_days: [0, 1, 2, 3, 4, 5, 6],
          start_date: '2026-09-01',
          goal_value: 10,
          goal_unit: 'pages',
          reminder_enabled: 0,
          reminder_time: '21:00',
          status: 'active'
        }
      ]);
    }

    // 5. Seed Completions
    if (!this.get('completions')) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      this.set('completions', [
        { id: 1, habit_id: 13, user_id: 20, completed_date: yesterdayStr, created_at: new Date().toISOString() }
      ]);
    }

    // 6. Seed Tasks
    if (!this.get('tasks')) {
      const todayStr = new Date().toISOString().split('T')[0];
      this.set('tasks', [
        {
          id: 1,
          user_id: 20,
          category_id: 4,
          title: 'Review today priorities',
          description: 'Plan focus areas and daily goals',
          date: todayStr,
          completed: 0,
          priority: 'high',
          due_time: '10:00',
          sort_order: 0
        },
        {
          id: 2,
          user_id: 20,
          category_id: 2,
          title: 'Organize study notes',
          description: 'Review trading strategy notes',
          date: todayStr,
          completed: 0,
          priority: 'medium',
          due_time: '16:00',
          sort_order: 1
        }
      ]);
    }

    // 7. Seed Goals
    if (!this.get('goals')) {
      this.set('goals', [
        {
          id: 1,
          user_id: 20,
          category_id: 1,
          title: 'Consistent 30-Day Routine',
          description: 'Build unshakeable daily habits',
          target_value: 30,
          current_value: 8,
          unit: 'days',
          status: 'in_progress',
          color: '#10b981'
        }
      ]);
    }
  },

  getCurrentUser() {
    const token = localStorage.getItem('habit_tracker_token');
    const users = this.get('users') || [];
    if (!token) return users[0] || null;
    return users.find(u => String(u.id) === String(token)) || users[0] || null;
  },

  calculateHabitStats(habitId, userId) {
    const completions = (this.get('completions') || []).filter(c => c.habit_id === habitId && String(c.user_id) === String(userId));
    const total_completions = completions.length;
    
    // Sort dates descending
    const dates = completions.map(c => c.completed_date).sort().reverse();
    let current_streak = 0;
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    if (dates.includes(todayStr) || dates.includes(yesterdayStr)) {
      let checkDate = dates.includes(todayStr) ? new Date(today) : new Date(yesterday);
      while (true) {
        const checkStr = checkDate.toISOString().split('T')[0];
        if (dates.includes(checkStr)) {
          current_streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
    }

    const best_streak = Math.max(current_streak, total_completions > 0 ? 5 : 0);
    const completion_rate = total_completions > 0 ? Math.min(100, Math.round((total_completions / 14) * 100)) : 0;

    return {
      current_streak,
      best_streak,
      completion_rate,
      total_completions,
      missed_days: Math.max(0, 7 - total_completions)
    };
  },

  async handle(method, endpoint, body) {
    this.init();
    const urlParts = endpoint.split('?');
    const path = urlParts[0];
    const params = new URLSearchParams(urlParts[1] || '');
    const currentUser = this.getCurrentUser();
    const todayStr = new Date().toISOString().split('T')[0];

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    // ================== AUTH ROUTES ==================
    if (path === '/api/auth/register') {
      const { name, email, password } = body || {};
      if (!name || !email || !password) throw new Error('Name, email, and password are required.');
      const users = this.get('users') || [];
      if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
        throw new Error('An account with this email already exists.');
      }
      const newUser = {
        id: Date.now(),
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        created_at: new Date().toISOString()
      };
      users.push(newUser);
      this.set('users', users);
      API.setToken(String(newUser.id));
      return {
        message: 'Account created successfully.',
        user: { id: newUser.id, name: newUser.name, email: newUser.email },
        token: String(newUser.id)
      };
    }

    if (path === '/api/auth/login') {
      const { email, password } = body || {};
      if (!email || !password) throw new Error('Email and password are required.');
      const users = this.get('users') || [];
      const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (!user || user.password !== password) {
        throw new Error('Invalid email or password.');
      }
      API.setToken(String(user.id));
      return {
        message: 'Logged in successfully.',
        user: { id: user.id, name: user.name, email: user.email },
        token: String(user.id)
      };
    }

    if (path === '/api/auth/me') {
      let token = API.getToken();
      if (!token) {
        token = '20';
        API.setToken('20');
      }
      const user = currentUser || (this.get('users') || [])[0];
      if (!user) throw new Error('User not found.');
      const settings = this.get('settings') || {};
      settings.onboarding_completed = 1;
      return {
        user: { id: user.id, name: user.name, email: user.email, streak_freeze_available: 1 },
        settings: settings
      };
    }

    if (path === '/api/auth/logout') {
      API.setToken(null);
      return { message: 'Logged out successfully.' };
    }

    if (path === '/api/auth/forgot-password') {
      return { message: 'Reset token generated.', reset_token: 'local-reset-token-2026' };
    }

    if (path === '/api/auth/reset-password') {
      const { password } = body || {};
      const users = this.get('users') || [];
      if (currentUser) {
        currentUser.password = password;
        this.set('users', users);
      }
      return { message: 'Password has been reset successfully. Please log in.' };
    }

    if (path === '/api/auth/password') {
      const { new_password } = body || {};
      const users = this.get('users') || [];
      if (currentUser) {
        currentUser.password = new_password;
        this.set('users', users);
      }
      return { message: 'Password updated successfully.' };
    }

    if (path === '/api/auth/account') {
      let users = this.get('users') || [];
      users = users.filter(u => String(u.id) !== String(currentUser.id));
      this.set('users', users);
      API.setToken(null);
      return { message: 'Account deleted successfully.' };
    }

    if (path === '/api/auth/onboarding') {
      const settings = this.get('settings') || {};
      settings.onboarding_completed = 1;
      this.set('settings', settings);
      return { message: 'Onboarding marked as completed.' };
    }

    // ================== CATEGORIES ==================
    if (path === '/api/categories') {
      return { categories: this.get('categories') || [] };
    }

    // ================== SETTINGS ==================
    if (path === '/api/settings') {
      if (method === 'GET') {
        return {
          user: currentUser || {},
          settings: this.get('settings') || {}
        };
      }
      if (method === 'PUT') {
        const settings = { ...(this.get('settings') || {}), ...(body || {}) };
        this.set('settings', settings);
        return { message: 'Settings saved successfully.', settings };
      }
    }

    // ================== DASHBOARD ROUTES ==================
    if (path === '/api/dashboard/today') {
      const habits = (this.get('habits') || []).filter(h => String(h.user_id) === String(currentUser.id) && h.status !== 'archived');
      const completions = (this.get('completions') || []).filter(c => String(c.user_id) === String(currentUser.id) && c.completed_date === todayStr);
      const completedHabitIds = new Set(completions.map(c => c.habit_id));

      const categories = this.get('categories') || [];
      const catMap = Object.fromEntries(categories.map(c => [c.id, c]));

      const habitsWithStatus = habits.map(h => {
        const cat = catMap[h.category_id];
        return {
          ...h,
          category_name: cat ? cat.name : null,
          category_color: cat ? cat.color : null,
          is_completed: completedHabitIds.has(h.id),
          completed_at: completedHabitIds.has(h.id) ? todayStr : null,
          stats: this.calculateHabitStats(h.id, currentUser.id)
        };
      });

      const allTasks = this.get('tasks') || [];
      const todayTasks = allTasks.filter(t => String(t.user_id) === String(currentUser.id) && t.date === todayStr).map(t => {
        const cat = catMap[t.category_id];
        return {
          ...t,
          category_name: cat ? cat.name : null,
          category_color: cat ? cat.color : null,
          completed: Boolean(t.completed)
        };
      });

      const tomorrowTasks = allTasks.filter(t => String(t.user_id) === String(currentUser.id) && t.date === tomorrowStr);

      const habitsCompleted = habitsWithStatus.filter(h => h.is_completed).length;
      const tasksCompleted = todayTasks.filter(t => t.completed).length;
      const totalItems = habitsWithStatus.length + todayTasks.length;
      const completedItems = habitsCompleted + tasksCompleted;
      const percent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

      const dateDisplay = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      const currentHour = new Date().getHours();
      let greeting = 'Good morning';
      if (currentHour >= 12 && currentHour < 17) greeting = 'Good afternoon';
      else if (currentHour >= 17) greeting = 'Good evening';

      return {
        user_name: currentUser ? currentUser.name : 'Aman',
        greeting: `${greeting}, ${currentUser ? currentUser.name : 'Friend'}`,
        date: todayStr,
        date_display: dateDisplay,
        quote: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.",
        motivation: percent === 100 ? "🎉 Fantastic work! You've accomplished all of today's targets!" : (completedItems > 0 ? `Great momentum! ${completedItems} items done, keep going!` : "Start strong today! Complete your first item."),
        progress: {
          percent,
          total_items: totalItems,
          completed_items: completedItems,
          remaining_items: Math.max(0, totalItems - completedItems),
          habits_total: habitsWithStatus.length,
          habits_completed: habitsCompleted,
          tasks_total: todayTasks.length,
          tasks_completed: tasksCompleted
        },
        habits: habitsWithStatus,
        tasks: todayTasks,
        tomorrow_preview: {
          date: tomorrowStr,
          habits_count: habitsWithStatus.length,
          tasks_count: tomorrowTasks.length,
          total_planned: habitsWithStatus.length + tomorrowTasks.length
        }
      };
    }

    if (path === '/api/dashboard/tomorrow') {
      const habits = (this.get('habits') || []).filter(h => String(h.user_id) === String(currentUser.id) && h.status !== 'archived');
      const allTasks = this.get('tasks') || [];
      const categories = this.get('categories') || [];
      const catMap = Object.fromEntries(categories.map(c => [c.id, c]));

      const tomorrowTasks = allTasks.filter(t => String(t.user_id) === String(currentUser.id) && t.date === tomorrowStr).map(t => {
        const cat = catMap[t.category_id];
        return { ...t, category_name: cat ? cat.name : null, category_color: cat ? cat.color : null };
      });

      return {
        date: tomorrowStr,
        date_display: new Date(tomorrow).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
        habits_count: habits.length,
        habits,
        tasks: tomorrowTasks
      };
    }

    if (path === '/api/dashboard/carry-forward') {
      const tasks = this.get('tasks') || [];
      let carried = 0;
      tasks.forEach(t => {
        if (String(t.user_id) === String(currentUser.id) && t.date === todayStr && !t.completed) {
          t.date = tomorrowStr;
          carried++;
        }
      });
      this.set('tasks', tasks);
      return { message: `Moved ${carried} pending tasks to tomorrow!`, carried_count: carried };
    }

    // ================== HABITS ROUTES ==================
    if (path === '/api/habits' && method === 'GET') {
      const statusFilter = params.get('status') || 'active';
      let habits = (this.get('habits') || []).filter(h => String(h.user_id) === String(currentUser.id));
      if (statusFilter !== 'all') {
        habits = habits.filter(h => h.status === statusFilter);
      }
      const categories = this.get('categories') || [];
      const catMap = Object.fromEntries(categories.map(c => [c.id, c]));

      const result = habits.map(h => {
        const cat = catMap[h.category_id];
        return {
          ...h,
          category_name: cat ? cat.name : null,
          category_color: cat ? cat.color : null,
          stats: this.calculateHabitStats(h.id, currentUser.id)
        };
      });
      return { habits: result };
    }

    if (path === '/api/habits' && method === 'POST') {
      const habits = this.get('habits') || [];
      const newHabit = {
        id: Date.now(),
        user_id: currentUser.id,
        category_id: body.category_id ? parseInt(body.category_id) : null,
        name: body.name.trim(),
        description: body.description || '',
        icon: body.icon || 'target',
        color: body.color || '#10b981',
        frequency_type: body.frequency_type || 'daily',
        frequency_days: body.frequency_days || [0, 1, 2, 3, 4, 5, 6],
        start_date: body.start_date || todayStr,
        goal_value: body.goal_value || null,
        goal_unit: body.goal_unit || null,
        reminder_enabled: body.reminder_enabled ? 1 : 0,
        reminder_time: body.reminder_time || '20:00',
        status: 'active',
        created_at: new Date().toISOString()
      };
      habits.push(newHabit);
      this.set('habits', habits);
      return { message: 'Habit created successfully.', habit: newHabit };
    }

    // Habit ID subroutes
    const habitMatch = path.match(/^\/api\/habits\/(\d+)(?:\/(.*))?$/);
    if (habitMatch) {
      const habitId = parseInt(habitMatch[1]);
      const subAction = habitMatch[2];
      const habits = this.get('habits') || [];
      const habit = habits.find(h => h.id === habitId);

      if (subAction === 'toggle' && method === 'POST') {
        let completions = this.get('completions') || [];
        const dateTarget = (body && body.date) ? body.date : todayStr;
        const existingIdx = completions.findIndex(c => c.habit_id === habitId && String(c.user_id) === String(currentUser.id) && c.completed_date === dateTarget);

        let completed = false;
        if (existingIdx >= 0) {
          completions.splice(existingIdx, 1);
          completed = false;
        } else {
          completions.push({
            id: Date.now(),
            habit_id: habitId,
            user_id: currentUser.id,
            completed_date: dateTarget,
            created_at: new Date().toISOString()
          });
          completed = true;
        }
        this.set('completions', completions);
        return {
          message: completed ? 'Habit marked complete!' : 'Habit marked incomplete',
          completed,
          stats: this.calculateHabitStats(habitId, currentUser.id)
        };
      }

      if (subAction === 'status' && method === 'PATCH') {
        if (habit) {
          habit.status = body.status;
          this.set('habits', habits);
        }
        return { message: 'Habit status updated successfully.' };
      }

      if (!subAction && method === 'GET') {
        if (!habit) throw new Error('Habit not found');
        return { habit, stats: this.calculateHabitStats(habitId, currentUser.id), completions: (this.get('completions') || []).filter(c => c.habit_id === habitId) };
      }

      if (!subAction && method === 'PUT') {
        if (habit) {
          Object.assign(habit, body);
          this.set('habits', habits);
        }
        return { message: 'Habit updated successfully.', habit };
      }

      if (!subAction && method === 'DELETE') {
        const filtered = habits.filter(h => h.id !== habitId);
        this.set('habits', filtered);
        return { message: 'Habit deleted successfully.' };
      }
    }

    // ================== TASKS ROUTES ==================
    if (path === '/api/tasks' && method === 'GET') {
      const dateQuery = params.get('date') || todayStr;
      const allTasks = this.get('tasks') || [];
      const categories = this.get('categories') || [];
      const catMap = Object.fromEntries(categories.map(c => [c.id, c]));

      const tasks = allTasks
        .filter(t => String(t.user_id) === String(currentUser.id) && t.date === dateQuery)
        .map(t => {
          const cat = catMap[t.category_id];
          return {
            ...t,
            category_name: cat ? cat.name : null,
            category_color: cat ? cat.color : null,
            completed: Boolean(t.completed)
          };
        })
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

      return { tasks, date: dateQuery };
    }

    if (path === '/api/tasks' && method === 'POST') {
      const allTasks = this.get('tasks') || [];
      const newTask = {
        id: Date.now(),
        user_id: currentUser.id,
        category_id: body.category_id ? parseInt(body.category_id) : null,
        title: body.title.trim(),
        description: body.description || '',
        date: body.date || todayStr,
        priority: body.priority || 'medium',
        due_time: body.due_time || '',
        completed: 0,
        sort_order: allTasks.length,
        created_at: new Date().toISOString()
      };
      allTasks.push(newTask);
      this.set('tasks', allTasks);
      return { message: 'Task created successfully.', task: newTask };
    }

    if (path === '/api/tasks/reorder' && method === 'PATCH') {
      const taskIds = body.task_ids || [];
      const allTasks = this.get('tasks') || [];
      taskIds.forEach((id, idx) => {
        const t = allTasks.find(item => item.id === parseInt(id));
        if (t) t.sort_order = idx;
      });
      this.set('tasks', allTasks);
      return { message: 'Tasks reordered.' };
    }

    // Task ID subroutes
    const taskMatch = path.match(/^\/api\/tasks\/(\d+)(?:\/(.*))?$/);
    if (taskMatch) {
      const taskId = parseInt(taskMatch[1]);
      const subAction = taskMatch[2];
      const allTasks = this.get('tasks') || [];
      const task = allTasks.find(t => t.id === taskId);

      if (subAction === 'toggle' && method === 'PATCH') {
        if (task) {
          task.completed = task.completed ? 0 : 1;
          this.set('tasks', allTasks);
        }
        return { message: 'Task updated.', completed: Boolean(task ? task.completed : false) };
      }

      if (subAction === 'move' && method === 'PATCH') {
        if (task) {
          task.date = body.date || tomorrowStr;
          this.set('tasks', allTasks);
        }
        return { message: 'Task moved successfully.' };
      }

      if (subAction === 'duplicate' && method === 'POST') {
        if (task) {
          const dup = { ...task, id: Date.now(), completed: 0, date: body.date || task.date };
          allTasks.push(dup);
          this.set('tasks', allTasks);
        }
        return { message: 'Task duplicated successfully.' };
      }

      if (!subAction && method === 'PUT') {
        if (task) {
          Object.assign(task, body);
          this.set('tasks', allTasks);
        }
        return { message: 'Task updated successfully.', task };
      }

      if (!subAction && method === 'DELETE') {
        const filtered = allTasks.filter(t => t.id !== taskId);
        this.set('tasks', filtered);
        return { message: 'Task deleted successfully.' };
      }
    }

    // ================== GOALS ROUTES ==================
    if (path === '/api/goals' && method === 'GET') {
      const allGoals = (this.get('goals') || []).filter(g => String(g.user_id) === String(currentUser.id));
      const categories = this.get('categories') || [];
      const catMap = Object.fromEntries(categories.map(c => [c.id, c]));

      const goalsWithPercent = allGoals.map(g => {
        const cat = catMap[g.category_id];
        const target = parseFloat(g.target_value) || 1;
        const current = parseFloat(g.current_value) || 0;
        const percent = Math.min(100, Math.round((current / target) * 100));
        return {
          ...g,
          category_name: cat ? cat.name : null,
          percent
        };
      });
      return { goals: goalsWithPercent };
    }

    if (path === '/api/goals' && method === 'POST') {
      const allGoals = this.get('goals') || [];
      const newGoal = {
        id: Date.now(),
        user_id: currentUser.id,
        category_id: body.category_id ? parseInt(body.category_id) : null,
        title: body.title.trim(),
        description: body.description || '',
        target_value: parseFloat(body.target_value) || 10,
        current_value: parseFloat(body.current_value) || 0,
        unit: body.unit || 'units',
        color: body.color || '#10b981',
        status: 'in_progress',
        created_at: new Date().toISOString()
      };
      allGoals.push(newGoal);
      this.set('goals', allGoals);
      return { message: 'Goal created successfully.', goal: newGoal };
    }

    const goalMatch = path.match(/^\/api\/goals\/(\d+)(?:\/(.*))?$/);
    if (goalMatch) {
      const goalId = parseInt(goalMatch[1]);
      const subAction = goalMatch[2];
      const allGoals = this.get('goals') || [];
      const goal = allGoals.find(g => g.id === goalId);

      if (subAction === 'progress' && method === 'PATCH') {
        if (goal) {
          if (body.delta !== undefined) {
            goal.current_value = Math.max(0, (parseFloat(goal.current_value) || 0) + parseFloat(body.delta));
          } else if (body.current_value !== undefined) {
            goal.current_value = Math.max(0, parseFloat(body.current_value) || 0);
          }
          if (goal.current_value >= goal.target_value) goal.status = 'completed';
          this.set('goals', allGoals);
        }
        return { message: 'Progress updated.' };
      }

      if (!subAction && method === 'PUT') {
        if (goal) {
          Object.assign(goal, body);
          this.set('goals', allGoals);
        }
        return { message: 'Goal updated successfully.', goal };
      }

      if (!subAction && method === 'DELETE') {
        const filtered = allGoals.filter(g => g.id !== goalId);
        this.set('goals', filtered);
        return { message: 'Goal deleted successfully.' };
      }
    }

    // ================== INSIGHTS ROUTES ==================
    if (path === '/api/insights/summary') {
      const habits = (this.get('habits') || []).filter(h => String(h.user_id) === String(currentUser.id));
      const completions = (this.get('completions') || []).filter(c => String(c.user_id) === String(currentUser.id));
      const tasks = (this.get('tasks') || []).filter(t => String(t.user_id) === String(currentUser.id));

      const completedTasks = tasks.filter(t => t.completed).length;
      const totalTasks = tasks.length;
      const taskRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      // Weekly summary (last 7 days)
      const weeklyProgress = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dStr = d.toISOString().split('T')[0];
        const dayHabitDone = completions.filter(c => c.completed_date === dStr).length;
        const dayTasksDone = tasks.filter(t => t.date === dStr && t.completed).length;
        const dayTotal = Math.max(1, habits.length + tasks.filter(t => t.date === dStr).length);
        const done = dayHabitDone + dayTasksDone;
        const pct = Math.min(100, Math.round((done / dayTotal) * 100));

        weeklyProgress.push({
          date: dStr,
          day_name: d.toLocaleDateString('en-US', { weekday: 'narrow' }),
          day_full: d.toLocaleDateString('en-US', { weekday: 'short' }),
          percent: pct,
          completed_items: done,
          total_items: dayTotal
        });
      }

      // Heatmap 60 days
      const heatmap = [];
      for (let i = 59; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dStr = d.toISOString().split('T')[0];
        const count = completions.filter(c => c.completed_date === dStr).length;
        let intensity = 0;
        if (count >= 3) intensity = 4;
        else if (count === 2) intensity = 3;
        else if (count === 1) intensity = 1;

        heatmap.push({
          date: dStr,
          date_display: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          count,
          intensity
        });
      }

      const habitRankings = habits.map(h => {
        const stats = this.calculateHabitStats(h.id, currentUser.id);
        return {
          id: h.id,
          name: h.name,
          icon: h.icon,
          color: h.color,
          current_streak: stats.current_streak,
          completion_rate: stats.completion_rate,
          total_completions: stats.total_completions
        };
      }).sort((a, b) => b.total_completions - a.total_completions);

      return {
        total_habits: habits.length,
        active_habits: habits.filter(h => h.status === 'active').length,
        total_completions: completions.length,
        current_overall_streak: habitRankings.length > 0 ? habitRankings[0].current_streak : 0,
        best_overall_streak: habitRankings.length > 0 ? Math.max(...habitRankings.map(r => r.current_streak), 5) : 0,
        average_completion_rate: habitRankings.length > 0 ? Math.round(habitRankings.reduce((s, r) => s + r.completion_rate, 0) / habitRankings.length) : 0,
        total_tasks: totalTasks,
        completed_tasks: completedTasks,
        pending_tasks: Math.max(0, totalTasks - completedTasks),
        habit_completions: completions.length,
        task_completion_rate: taskRate,
        weekly_progress: weeklyProgress,
        activity_heatmap: heatmap,
        habit_rankings: habitRankings
      };
    }

    // ================== CALENDAR ROUTES ==================
    if (path === '/api/calendar/month') {
      const year = parseInt(params.get('year')) || new Date().getFullYear();
      const month = parseInt(params.get('month')) || (new Date().getMonth() + 1);
      const habits = (this.get('habits') || []).filter(h => String(h.user_id) === String(currentUser.id));
      const completions = (this.get('completions') || []).filter(c => String(c.user_id) === String(currentUser.id));

      const firstDay = new Date(year, month - 1, 1);
      const lastDay = new Date(year, month, 0);
      const totalDays = lastDay.getDate();
      const days = [];

      for (let d = 1; d <= totalDays; d++) {
        const dateObj = new Date(year, month - 1, d);
        const dateStr = dateObj.toISOString().split('T')[0];
        const done = completions.filter(c => c.completed_date === dateStr).length;
        const total = Math.max(1, habits.length);
        const percent = Math.min(100, Math.round((done / total) * 100));

        let status = 'none';
        if (percent >= 80) status = 'great';
        else if (percent >= 50) status = 'good';
        else if (done > 0) status = 'poor';

        days.push({
          date: dateStr,
          day: d,
          is_current_month: true,
          is_today: dateStr === todayStr,
          status,
          habits_completed: done,
          habits_total: total,
          percent
        });
      }

      const monthName = firstDay.toLocaleDateString('en-US', { month: 'long' });
      return { year, month, month_name: monthName, days };
    }

    if (path === '/api/calendar/day') {
      const dateStr = params.get('date') || todayStr;
      const habits = (this.get('habits') || []).filter(h => String(h.user_id) === String(currentUser.id));
      const completions = (this.get('completions') || []).filter(c => String(c.user_id) === String(currentUser.id) && c.completed_date === dateStr);
      const completedIds = new Set(completions.map(c => c.habit_id));

      const tasks = (this.get('tasks') || []).filter(t => String(t.user_id) === String(currentUser.id) && t.date === dateStr);

      return {
        date: dateStr,
        date_display: new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
        habits: habits.map(h => ({ ...h, is_completed: completedIds.has(h.id) })),
        tasks
      };
    }

    // ================== DATA BACKUP / RESET ==================
    if (path === '/api/data/import') {
      if (body && body.data) {
        if (body.data.habits) this.set('habits', body.data.habits);
        if (body.data.tasks) this.set('tasks', body.data.tasks);
        if (body.data.goals) this.set('goals', body.data.goals);
        if (body.data.settings) this.set('settings', body.data.settings);
      }
      return { message: 'Data imported successfully!' };
    }

    if (path === '/api/data/reset') {
      localStorage.removeItem('mock_db_habits');
      localStorage.removeItem('mock_db_tasks');
      localStorage.removeItem('mock_db_goals');
      localStorage.removeItem('mock_db_completions');
      this.init();
      return { message: 'Data reset to defaults.' };
    }

    // Fallback for unhandled endpoints
    return { message: 'OK', success: true };
  }
};

// ==========================================
// Universal API Client
// Automatically routes between Flask backend & MockBackend
// ==========================================
const API = {
  forceStaticMode: null,

  isStaticMode() {
    if (this.forceStaticMode !== null) return this.forceStaticMode;
    const protocol = window.location.protocol;
    const host = window.location.hostname;
    // GitHub Pages, raw file system, or Vercel/Netlify static deployment
    return protocol === 'file:' || host.endsWith('github.io') || host.includes('github');
  },

  getToken() {
    return localStorage.getItem('habit_tracker_token');
  },

  setToken(token) {
    if (token) {
      localStorage.setItem('habit_tracker_token', token);
    } else {
      localStorage.removeItem('habit_tracker_token');
    }
  },

  async request(endpoint, options = {}) {
    // 1. If running on GitHub Pages or file://, run through MockBackend
    if (this.isStaticMode()) {
      return MockBackend.handle(options.method || 'GET', endpoint, options.body ? JSON.parse(options.body) : null);
    }

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(endpoint, {
        ...options,
        headers
      });

      // If unauthorized, clear token and open auth modal if needed
      if (response.status === 401) {
        this.setToken(null);
        if (window.Auth && !window.Auth.isPublicRoute()) {
          window.Auth.showAuthModal('login');
        }
      }

      // Check if response is 404 HTML (happens if static host serves index.html for 404s)
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        console.warn(`Endpoint ${endpoint} returned non-JSON (${response.status}). Switching to Offline LocalStorage mode.`);
        this.forceStaticMode = true;
        return MockBackend.handle(options.method || 'GET', endpoint, options.body ? JSON.parse(options.body) : null);
      }

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || data.message || 'Something went wrong. Please try again.');
      }

      return data;
    } catch (err) {
      // If Flask server is down or unreachable, fall back seamlessly to MockBackend
      if (err.name === 'TypeError' || err.message.includes('fetch') || err.message.includes('Failed to fetch')) {
        console.warn(`Live server unreachable at ${endpoint}. Seamlessly falling back to browser storage.`, err);
        this.forceStaticMode = true;
        Toast.info("Offline mode active — using local browser storage.");
        return MockBackend.handle(options.method || 'GET', endpoint, options.body ? JSON.parse(options.body) : null);
      }
      throw err;
    }
  },

  get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  },

  post(endpoint, body) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  },

  put(endpoint, body) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
  },

  patch(endpoint, body) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body)
    });
  },

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
};

/**
 * Toast Notification Utility
 */
const Toast = {
  show(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = '🔔';
    if (type === 'success') icon = '✓';
    if (type === 'error') icon = '✕';

    toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(15px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, duration);
  },

  success(msg) { this.show(msg, 'success'); },
  error(msg) { this.show(msg, 'error'); },
  info(msg) { this.show(msg, 'info'); }
};

window.API = API;
window.Toast = Toast;
window.MockBackend = MockBackend;
