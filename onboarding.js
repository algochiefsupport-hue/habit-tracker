/**
 * 3-Step Interactive Onboarding Controller for New Users
 */

const Onboarding = {
  currentStep: 1,
  selectedFocus: 'Health',

  start() {
    this.currentStep = 1;
    this.renderStep();
    const modal = document.getElementById('onboardingModal');
    if (modal) modal.classList.add('open');
  },

  selectFocus(focus) {
    this.selectedFocus = focus;
    document.querySelectorAll('.focus-card-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.focus === focus);
    });

    // Populate suggested habit name in step 2
    const suggestions = {
      'Health': { name: 'Drink 2L Water daily', icon: 'droplet', color: '#10b981' },
      'Fitness': { name: 'Morning 20-min Workout', icon: 'dumbbell', color: '#f59e0b' },
      'Productivity': { name: 'Plan tomorrow before sleep', icon: 'target', color: '#6366f1' },
      'Study': { name: 'Read 20 pages', icon: 'book-open', color: '#8b5cf6' },
      'Work': { name: 'Deep work focus session', icon: 'briefcase', color: '#3b82f6' },
      'Personal': { name: '10-minute Meditation', icon: 'smile', color: '#ec4899' }
    };

    const s = suggestions[focus] || suggestions['Health'];
    const habitInput = document.getElementById('onboardHabitName');
    if (habitInput) habitInput.value = s.name;
    this.onboardHabitIcon = s.icon;
    this.onboardHabitColor = s.color;
  },

  nextStep() {
    this.currentStep++;
    if (this.currentStep > 3) {
      this.finish();
    } else {
      this.renderStep();
    }
  },

  renderStep() {
    for (let i = 1; i <= 3; i++) {
      const el = document.getElementById(`onboardStep${i}`);
      if (el) el.style.display = (i === this.currentStep) ? 'block' : 'none';
    }

    if (this.currentStep === 1) {
      this.selectFocus(this.selectedFocus);
    }
  },

  async finish() {
    // 1. Create first habit if provided
    const habitName = document.getElementById('onboardHabitName')?.value.trim();
    if (habitName) {
      try {
        await API.post('/api/habits', {
          name: habitName,
          icon: this.onboardHabitIcon || 'target',
          color: this.onboardHabitColor || '#10b981',
          frequency_type: 'daily',
          start_date: new Date().toISOString().substring(0, 10)
        });
      } catch (e) {
        console.warn("Onboard habit create error:", e);
      }
    }

    // 2. Create first task if provided
    const taskTitle = document.getElementById('onboardTaskTitle')?.value.trim();
    if (taskTitle) {
      try {
        await API.post('/api/tasks', {
          title: taskTitle,
          date: new Date().toISOString().substring(0, 10),
          priority: 'high'
        });
      } catch (e) {
        console.warn("Onboard task create error:", e);
      }
    }

    // Mark onboarding complete on server
    try {
      await API.post('/api/auth/onboarding', {});
    } catch (e) {
      // Continue
    }

    const modal = document.getElementById('onboardingModal');
    if (modal) modal.classList.remove('open');

    Toast.success("You're all set! Welcome to your daily rhythm.");
    if (window.Dashboard) {
      await window.Dashboard.load();
    }
  },

  skip() {
    API.post('/api/auth/onboarding', {}).catch(() => {});
    const modal = document.getElementById('onboardingModal');
    if (modal) modal.classList.remove('open');
    if (window.Dashboard) {
      window.Dashboard.load();
    }
  }
};

window.Onboarding = Onboarding;
