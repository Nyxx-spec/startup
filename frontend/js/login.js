// frontend/js/login.js  —  Login page logic

async function doLogin() {
  var err  = document.getElementById('login-error');
  var email = document.getElementById('login-email').value.trim();
  var pass  = document.getElementById('login-pass').value.trim();
  err.classList.remove('show'); err.textContent = '';

  if (!email || !pass) { err.textContent = '⚠ Please fill in both fields.'; err.classList.add('show'); return; }

  var btn = document.getElementById('login-btn');
  btn.textContent = 'Signing in…'; btn.disabled = true;

  try {
    var user = await apiLogin(email, pass);
    // Block suspended accounts
    if (user.status === 'Suspended') {
      clearSession();
      var until = user.suspended_until
        ? ' Your suspension lifts on ' + new Date(user.suspended_until).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) + '.'
        : ' Your suspension is permanent.';
      err.textContent = '🔴 Your account has been suspended.' + until + ' Contact admin@freshsave.com to appeal.';
      err.classList.add('show');
      btn.textContent = 'Log In'; btn.disabled = false;
      return;
    }
    saveSession(user);
    showToast('✅ Welcome back, ' + user.name + '!');
    setTimeout(function () { redirectToDashboard(user); }, 500);
  } catch (e) {
    err.textContent = '❌ ' + (e.message || 'Incorrect email or password.');
    err.classList.add('show');
    btn.textContent = 'Log In'; btn.disabled = false;
  }
}

function quickAdminLogin() {
  document.getElementById('login-email').value = 'admin@freshsave.com';
  document.getElementById('login-pass').value  = 'admin123';
  doLogin();
}

// Enter key support
document.addEventListener('keydown', function(e){ if(e.key==='Enter') doLogin(); });

// Init
(async function () {
  await loadSession();
  if (currentUser) { redirectToDashboard(currentUser); return; }
  var hint = document.getElementById('admin-hint-email');
  if (hint) hint.textContent = 'admin@freshsave.com';
})();
