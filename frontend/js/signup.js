// frontend/js/signup.js  —  Registration page logic

var selectedRole = 'buyer';

function pickRole(card) {
  document.querySelectorAll('.role-card').forEach(function(c){ c.classList.remove('selected'); });
  card.classList.add('selected');
  selectedRole = card.dataset.role;
}

async function doSignup() {
  var err   = document.getElementById('signup-error');
  var name  = document.getElementById('signup-name').value.trim();
  var email = document.getElementById('signup-email').value.trim();
  var pass  = document.getElementById('signup-pass').value;
  var pass2 = document.getElementById('signup-pass2').value;
  err.classList.remove('show'); err.textContent = '';

  if (!name||!email||!pass||!pass2) { err.textContent='⚠ Please fill all fields.'; err.classList.add('show'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { err.textContent='⚠ Invalid email address.'; err.classList.add('show'); return; }
  if (pass.length < 6) { err.textContent='⚠ Password must be at least 6 characters.'; err.classList.add('show'); return; }
  if (pass !== pass2)  { err.textContent='❌ Passwords do not match.'; err.classList.add('show'); return; }

  var btn = document.getElementById('signup-btn');
  btn.textContent = 'Creating account…'; btn.disabled = true;

  try {
    var user = await apiSignup(name, email, pass, selectedRole);
    saveSession(user);
    showToast('🎉 Welcome to FreshSave, ' + name + '!');
    setTimeout(function () {
      if (user.role === 'seller') goSeller();
      else goBrowse();
    }, 500);
  } catch (e) {
    err.textContent = '❌ ' + (e.message || 'Could not create account.');
    err.classList.add('show');
    btn.textContent = 'Create Account'; btn.disabled = false;
  }
}

// Init
(async function () {
  await loadSession();
  if (currentUser) { redirectToDashboard(currentUser); }
})();
