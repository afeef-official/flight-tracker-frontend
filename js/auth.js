// Login gate: blocks the dashboard until the user signs in

const Auth = (() => {
  const USER_KEY = 'faroway_auth_user';
  const $ = (id) => document.getElementById(id);

  function showLogin() {
    document.documentElement.classList.remove('authed');
    $('loginOverlay')?.classList.remove('hidden');
    $('loginUsername')?.focus();
  }

  function hideLogin() {
    $('loginOverlay')?.classList.add('hidden');
  }

  function setUserLabel(name) {
    const el = $('currentUserName');
    if (el) el.textContent = name || '';
    $('logoutBtn')?.classList.toggle('hidden', !name);
  }

  function logout() {
    window.API.setToken(null);
    try { localStorage.removeItem(USER_KEY); } catch {}
    window.location.reload();
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!window.API.getToken()) showLogin();
    try { setUserLabel(localStorage.getItem(USER_KEY)); } catch {}

    $('logoutBtn')?.addEventListener('click', logout);

    $('loginForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = $('loginBtn');
      const errEl = $('loginError');
      errEl.classList.add('hidden');
      btn.disabled = true;
      try {
        const { token, user } = await window.API.login($('loginUsername').value, $('loginPassword').value);
        window.API.setToken(token);
        try { localStorage.setItem(USER_KEY, user.displayName); } catch {}
        window.location.reload();
      } catch (err) {
        errEl.textContent = err.message;
        errEl.classList.remove('hidden');
        btn.disabled = false;
      }
    });
  });

  return { showLogin, hideLogin };
})();

window.Auth = Auth;
