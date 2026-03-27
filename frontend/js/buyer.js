// frontend/js/buyer.js — Buyer dashboard logic

/* ══ TAB SWITCHER ═════════════════════════════════════════════ */
function dashTab(section, el) {
  document.querySelectorAll('.admin-nav-item').forEach(function (i) { i.classList.remove('active'); });
  document.querySelectorAll('.dash-section').forEach(function (s) { s.classList.remove('active'); });
  if (el) el.classList.add('active');
  document.getElementById('dash-' + section).classList.add('active');
}

/* ══ ORDERS ═══════════════════════════════════════════════════ */
async function loadMyOrders() {
  var tbody = document.getElementById('orders-tbody');
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--gray)">Loading orders…</td></tr>';
  try {
    var orders = await apiGetMyReservations();
    setEl('stat-total',    orders.length);
    setEl('stat-reserved', orders.filter(function(o){ return o.status==='Reserved'; }).length);
    setEl('stat-pickedup', orders.filter(function(o){ return o.status==='Picked Up';}).length);
    setEl('stat-cancelled',orders.filter(function(o){ return o.status==='Cancelled';}).length);
    setEl('profile-orders', orders.length);
    renderOrdersTable(orders);
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--gray)">Could not load orders.</td></tr>';
  }
}

function renderOrdersTable(orders) {
  var tbody = document.getElementById('orders-tbody');
  if (!orders.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--gray)">No orders yet. <a onclick="goBrowse()" style="color:var(--green);cursor:pointer;font-weight:600">Browse deals</a></td></tr>';
    return;
  }
  var sColors = { 'Reserved':'var(--green)','Picked Up':'#1D4ED8','Disputed':'var(--red)','Cancelled':'var(--gray)','Refunded':'var(--purple)' };
  var sBgs    = { 'Reserved':'#E8F5EE','Picked Up':'#E8F4FD','Disputed':'#FEF0EC','Cancelled':'#F3F4F6','Refunded':'#EDE9FE' };
  var pIcons  = {
    'Awaiting Pickup': '<i class="bi bi-hourglass-split"></i>',
    'Collected':       '<i class="bi bi-check-circle-fill" style="color:var(--green)"></i>',
    'Cancelled':       '<i class="bi bi-x-circle-fill" style="color:var(--gray)"></i>',
    'Issue Raised':    '<i class="bi bi-exclamation-triangle-fill" style="color:var(--amber)"></i>',
    'Refund Issued':   '<i class="bi bi-cash-stack" style="color:var(--blue)"></i>'
  };
  tbody.innerHTML = orders.map(function (o) {
    var st  = o.status || 'Reserved';
    var ps  = o.pickup_status || 'Awaiting Pickup';
    var sc  = sColors[st] || 'var(--gray)';
    var sb  = sBgs[st]    || '#F3F4F6';
    var pi  = pIcons[ps]  || '<i class="bi bi-box"></i>';
    var act = st === 'Reserved'
      ? '<button class="btn btn-xs btn-red" onclick="cancelOrder(\'' + o.id + '\')"><i class="bi bi-x-lg"></i> Cancel</button>'
      : '';
    return '<tr>'
      + '<td style="font-size:12px;font-weight:800;color:var(--admin)">' + escHtml(o.id) + '</td>'
      + '<td><strong>' + escHtml(o.item) + '</strong><div style="font-size:11px;color:var(--gray)"><i class="bi bi-shop"></i> ' + escHtml(o.business) + '</div></td>'
      + '<td><strong style="color:var(--green)">' + escHtml(o.price) + '</strong></td>'
      + '<td>' + pi + ' <span style="font-size:12px">' + escHtml(ps) + '</span></td>'
      + '<td>' + fmtDate(o.created_at) + '</td>'
      + '<td><span style="display:inline-block;background:' + sb + ';color:' + sc + ';font-size:11px;font-weight:700;padding:3px 10px;border-radius:50px">' + escHtml(st) + '</span></td>'
      + '<td>' + act + '</td>'
      + '</tr>';
  }).join('');
}

async function cancelOrder(id) {
  if (!confirm('Cancel this reservation?')) return;
  try {
    await apiCancelOrder(id);
    showToast('Order cancelled.');
    loadMyOrders();
  } catch (e) { showToast('Error: ' + e.message); }
}

/* ══ PROFILE ══════════════════════════════════════════════════ */
function changeProfilePhoto(event, role) {
  var file = event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { showToast('Please select an image file.'); return; }
  if (file.size > 5 * 1024 * 1024) { showToast('Image must be 5 MB or smaller.'); return; }
  var reader = new FileReader();
  reader.onload = function (e) {
    var dataUrl = e.target.result;
    var key = 'fs_avatar_' + (currentUser ? currentUser.id : role);
    localStorage.setItem(key, dataUrl);
    _applyAvatar(dataUrl);
    showToast('Profile photo updated!');
  };
  reader.readAsDataURL(file);
}

function _applyAvatar(dataUrl) {
  var el = document.getElementById('profile-avatar');
  if (!el) return;
  el.innerHTML = '<img src="' + dataUrl + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />';
}

function renderProfile() {
  if (!currentUser) return;
  setEl('profile-name',    currentUser.name);
  setEl('profile-email',   currentUser.email);
  setEl('profile-status',  currentUser.status || 'Active');
  setEl('profile-joined',  fmtDate(currentUser.joined_at));
  setEl('profile-login',   fmtDate(currentUser.last_login));
  setEl('profile-id',      currentUser.id ? currentUser.id.slice(0, 16) + '\u2026' : '\u2014');
  // Total orders will be updated after loadMyOrders() resolves — update it there
  var savedPhoto = localStorage.getItem('fs_avatar_' + currentUser.id);
  if (savedPhoto) _applyAvatar(savedPhoto);
}


/* ══ REPORT ═══════════════════════════════════════════════════ */
async function submitReport() {
  var against    = document.getElementById('rep-against').value.trim();
  var issue_type = document.getElementById('rep-type').value;
  var details    = document.getElementById('rep-details').value.trim();
  if (!against || !issue_type) { showToast('Please fill all required fields.'); return; }
  var btn = document.getElementById('rep-btn');
  btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Submitting…'; btn.disabled = true;
  try {
    await apiSubmitReport({ against, issue_type, details });
    document.getElementById('rep-against').value = '';
    document.getElementById('rep-details').value = '';
    showToast('Report submitted. Admin will review it shortly.');
  } catch (e) { showToast('Error: ' + e.message); }
  btn.innerHTML = '<i class="bi bi-flag-fill"></i> Submit Report'; btn.disabled = false;
}

/* ══ NOTIFICATIONS ═══════════════════════════════════════════ */
var _notifPanelOpen = false;

function toggleNotifPanel() {
  var panel = document.getElementById('notif-panel');
  if (!panel) return;
  _notifPanelOpen = !_notifPanelOpen;
  panel.style.display = _notifPanelOpen ? 'block' : 'none';
  if (_notifPanelOpen) { loadUserNotifs(); markAllRead(); }
}

document.addEventListener('click', function (e) {
  var bell = document.getElementById('notif-bell');
  var panel = document.getElementById('notif-panel');
  if (panel && bell && !bell.contains(e.target) && !panel.contains(e.target)) {
    panel.style.display = 'none';
    _notifPanelOpen = false;
  }
});

async function loadUserNotifs() {
  var list = document.getElementById('notif-list-user');
  if (!list) return;
  try {
    var notifs = await apiGetNotifications();
    var mine = notifs.filter(function (n) {
      return n.target === 'All Users' || n.target === 'Buyers Only' || n.target === ('personal:' + currentUser.id);
    });
    if (!mine.length) {
      list.innerHTML = '<div style="text-align:center;padding:24px;color:#94A3B8;font-size:13px"><i class="bi bi-bell-slash" style="font-size:1.5rem;display:block;margin-bottom:8px"></i>No notifications yet.</div>';
      return;
    }
    var icons = { deal: 'bi-bag-heart-fill', promo: 'bi-stars', reminder: 'bi-clock-fill', system: 'bi-gear-fill' };
    var lastSeen = parseInt(localStorage.getItem('fs_notif_seen_' + (currentUser ? currentUser.id : '')) || '0', 10);
    list.innerHTML = mine.map(function (n) {
      var isNew = new Date(n.created_at).getTime() > lastSeen;
      var ic = icons[n.type] || 'bi-bell-fill';
      return '<div style="display:flex;gap:12px;padding:12px 16px;border-bottom:1px solid #F1F5F9;background:' + (isNew ? '#F0FDF4' : '#fff') + ';align-items:flex-start">'
        + '<div style="width:32px;height:32px;border-radius:50%;background:' + (isNew ? '#DCFCE7' : '#F1F5F9') + ';display:flex;align-items:center;justify-content:center;flex-shrink:0">'
        + '<i class="bi ' + ic + '" style="color:' + (isNew ? '#2D6A4F' : '#64748B') + ';font-size:14px"></i></div>'
        + '<div style="flex:1"><div style="font-size:13px;font-weight:' + (isNew ? '600' : '400') + ';color:#1E293B;line-height:1.4">' + escHtml(n.msg) + '</div>'
        + '<div style="font-size:11px;color:#94A3B8;margin-top:3px" title="' + (n.created_at ? new Date(n.created_at).toLocaleString('en-PH') : '') + '">' + timeAgo(n.created_at) + (isNew ? ' &nbsp;<span style="background:#2D6A4F;color:#fff;font-size:9px;padding:1px 6px;border-radius:50px">NEW</span>' : '') + '</div>'
        + '</div></div>';
    }).join('');
    var unread = mine.filter(function (n) { return new Date(n.created_at).getTime() > lastSeen; }).length;
    var badge = document.getElementById('notif-badge');
    if (badge) {
      if (unread > 0) { badge.textContent = unread > 9 ? '9+' : unread; badge.style.display = 'flex'; }
      else { badge.style.display = 'none'; }
    }
  } catch (e) {
    list.innerHTML = '<div style="text-align:center;padding:20px;color:#94A3B8;font-size:13px">Could not load notifications.</div>';
  }
}

function markAllRead() {
  if (!currentUser) return;
  localStorage.setItem('fs_notif_seen_' + currentUser.id, Date.now().toString());
  var badge = document.getElementById('notif-badge');
  if (badge) badge.style.display = 'none';
}

/* ══ INIT ═════════════════════════════════════════════════════ */
(async function () {
  await loadSession();
  if (!currentUser)                   { goLogin();  return; }
  if (currentUser.role === 'admin')   { goAdmin();  return; }
  if (currentUser.role === 'seller')  { goSeller(); return; }
  document.getElementById('buyer-greeting').textContent = 'Hi, ' + currentUser.name;
  renderProfile();
  loadMyOrders();
  loadUserNotifs();
  setInterval(loadUserNotifs, 30000);
})();
