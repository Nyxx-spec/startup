// frontend/js/app.js
// Shared utilities — loaded on every page.

/* ══ SESSION ══════════════════════════════════════════════════ */
var currentUser = null;

async function loadSession() {
  if (!localStorage.getItem('fs_token')) return;
  try { currentUser = await apiGetMe(); }
  catch (e) { localStorage.removeItem('fs_token'); currentUser = null; }
}
function saveSession(user) { currentUser = user; }
function clearSession()    { currentUser = null; apiLogout(); }

/* ══ NAVIGATION ═══════════════════════════════════════════════ */
var _inPages = window.location.pathname.replace(/\\/g, '/').indexOf('/pages/') !== -1;
var _base    = _inPages ? '../' : '';
var _pages   = _inPages ? ''    : 'pages/';

function goHome()    { window.location.href = _base  + 'index.html';  }
function goLogin()   { window.location.href = _pages + 'login.html';  }
function goSignup()  { window.location.href = _pages + 'signup.html'; }
function goBrowse()  { window.location.href = _pages + 'browse.html'; }
function goBuyer()   { window.location.href = _pages + 'buyer.html';  }
function goSeller()  { window.location.href = _pages + 'seller.html'; }
function goAdmin()   { window.location.href = _pages + 'admin.html';  }
function goAuth(tab) { if (tab === 'signup') goSignup(); else goLogin(); }

function doLogout() {
  clearSession();
  showToast('You have been logged out.');
  setTimeout(goHome, 700);
}

function redirectToDashboard(user) {
  if (!user) return;
  if (user.role === 'admin')  { goAdmin();  return; }
  if (user.role === 'seller') { goSeller(); return; }
  goBuyer();
}

/* ══ SHARED NAVBAR ════════════════════════════════════════════ */
function updateNavbar() {
  var nb = document.getElementById('nav-btns');
  if (!nb) return;
  if (currentUser) {
    var dash = '';
    if (currentUser.role === 'admin')  dash = '<button class="btn btn-admin btn-sm" onclick="goAdmin()"><i class="bi bi-gear-fill"></i> Admin</button>';
    if (currentUser.role === 'seller') dash = '<button class="btn btn-green btn-sm" onclick="goSeller()"><i class="bi bi-box-seam-fill"></i> Dashboard</button>';
    if (currentUser.role === 'buyer')  dash = '<button class="btn btn-green btn-sm" onclick="goBuyer()"><i class="bi bi-clipboard2-check-fill"></i> My Orders</button>';
    nb.innerHTML =
      '<span style="font-size:14px;font-weight:600;color:var(--green)"><i class="bi bi-person-circle"></i> ' + escHtml(currentUser.name.split(' ')[0]) + '</span>'
      + '<span class="role-badge role-' + currentUser.role + '">' + currentUser.role.toUpperCase() + '</span>'
      + dash
      + '<button class="btn btn-outline btn-sm" onclick="doLogout()"><i class="bi bi-box-arrow-right"></i> Log Out</button>';
  } else {
    nb.innerHTML =
      '<button class="btn btn-outline" onclick="goLogin()">Log In</button>' +
      '<button class="btn btn-green"   onclick="goSignup()">Sign Up Free</button>';
  }
}

/* ══ HELPERS ══════════════════════════════════════════════════ */
function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmtDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('en-PH', { month:'short', day:'numeric', year:'numeric' }); }
  catch (e) { return iso; }
}
function timeAgo(iso) {
  if (!iso) return '';
  var now = Date.now();
  var then = new Date(iso).getTime();
  var s = Math.floor((now - then) / 1000);
  if (s < 10)  return 'just now';
  if (s < 60)  return s + 's ago';
  var m = Math.floor(s / 60);
  if (m < 60)  return m + ' min ago';
  var h = Math.floor(m / 60);
  if (h < 24)  return h + ' hr' + (h > 1 ? 's' : '') + ' ago';
  var d = Math.floor(h / 24);
  if (d === 1) return 'Yesterday';
  if (d < 7)   return d + ' days ago';
  return fmtDate(iso);
}
function fmtTime(t) {
  var p = t.split(':'), h = parseInt(p[0]), m = p[1], ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12; return h + ':' + m + ' ' + ap;
}
function setEl(id, v) { var el = document.getElementById(id); if (el) el.textContent = v; }
function showToast(msg, color) {
  var t = document.getElementById('fs-toast');
  if (!t) return;
  t.style.background = color || '#2D6A4F'; t.textContent = msg;
  t.style.opacity = '1'; t.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(t._tmr);
  t._tmr = setTimeout(function () { t.style.opacity = '0'; t.style.transform = 'translateX(-50%) translateY(100px)'; }, 3200);
}
function scrollToId(id) { var el = document.getElementById(id); if (el) el.scrollIntoView({ behavior:'smooth' }); }
function scrollTop()    { window.scrollTo({ top:0, behavior:'smooth' }); }
