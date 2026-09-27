/**
 * Authentication & Account Management UI Controller
 */

const Auth = {
  currentTab: 'login',

  isPublicRoute() {
    return false;
  },

  showAuthModal(tab = 'login') {
    this.currentTab = tab;
    const modal = document.getElementById('authModal');
    if (!modal) return;

    modal.classList.add('open');
    this.switchTab(tab);
  },

  hideAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) modal.classList.remove('open');
  },

  switchTab(tab) {
    this.currentTab = tab;
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const forgotForm = document.getElementById('forgotForm');
    const tabBtns = document.querySelectorAll('.auth-tab-btn');

    tabBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    if (loginForm) loginForm.style.display = (tab === 'login') ? 'flex' : 'none';
    if (registerForm) registerForm.style.display = (tab === 'register') ? 'flex' : 'none';
    if (forgotForm) forgotForm.style.display = (tab === 'forgot') ? 'flex' : 'none';
  },

  async handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    try {
      const data = await API.post('/api/auth/login', { email, password });
      API.setToken(data.token);
      Toast.success(`Welcome back, ${data.user.name}!`);
      this.hideAuthModal();
      await window.App.initSession();
    } catch (err) {
      Toast.error(err.message);
    }
  },

  async handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;

    try {
      const data = await API.post('/api/auth/register', { name, email, password });
      API.setToken(data.token);
      Toast.success(`Welcome to Habit Tracker, ${data.user.name}!`);
      this.hideAuthModal();
      await window.App.initSession();

      // Trigger Onboarding for new account
      if (window.Onboarding) {
        window.Onboarding.start();
      }
    } catch (err) {
      Toast.error(err.message);
    }
  },

  async handleForgotPassword(e) {
    e.preventDefault();
    const email = document.getElementById('forgotEmail').value.trim();

    try {
      const data = await API.post('/api/auth/forgot-password', { email });
      if (data.reset_token) {
        Toast.success("Reset code generated! Entering password reset mode.");
        document.getElementById('resetTokenInput').value = data.reset_token;
        document.getElementById('resetPasswordContainer').style.display = 'block';
      } else {
        Toast.info(data.message);
      }
    } catch (err) {
      Toast.error(err.message);
    }
  },

  async handleResetPassword(e) {
    e.preventDefault();
    const token = document.getElementById('resetTokenInput').value.trim();
    const password = document.getElementById('resetNewPassword').value;

    try {
      const data = await API.post('/api/auth/reset-password', { token, password });
      Toast.success(data.message);
      this.switchTab('login');
      document.getElementById('resetPasswordContainer').style.display = 'none';
    } catch (err) {
      Toast.error(err.message);
    }
  },

  async logout() {
    try {
      await API.post('/api/auth/logout');
    } catch (e) {
      // Continue anyway
    }
    API.setToken(null);
    window.App.currentUser = null;
    Toast.info("You have been logged out.");
    this.showAuthModal('login');
  }
};

window.Auth = Auth;
