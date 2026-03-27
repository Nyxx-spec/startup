// frontend/js/seller.js — Seller dashboard logic

/* ══ ICON MAP ═════════════════════════════════════════════════ */
var _typeIcons = {
  'Bakery': '<i class="bi bi-cake2"         style="font-size:2.4rem"></i>',
  'Restaurant': '<i class="bi bi-egg-fried"      style="font-size:2.4rem"></i>',

  'Café': '<i class="bi bi-cup-hot-fill"   style="font-size:2.4rem"></i>',
  'Pizzeria': '<i class="bi bi-pie-chart-fill" style="font-size:2.4rem"></i>',
  'Other': '<i class="bi bi-basket-fill"    style="font-size:2.4rem"></i>'
};

/* ══ TAB SWITCHER ═════════════════════════════════════════════ */
function dashTab(section, el) {
  document.querySelectorAll('.admin-nav-item').forEach(function (i) { i.classList.remove('active'); });
  document.querySelectorAll('.dash-section').forEach(function (s) { s.classList.remove('active'); });
  if (el) el.classList.add('active');
  document.getElementById('dash-' + section).classList.add('active');
}

/* ══ IMAGE UPLOAD ═════════════════════════════════════════════ */
var _selectedImageFile = null;

function _validateImageFile(file) {
  var allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type)) return 'Only JPG, PNG or WEBP images are allowed.';
  if (file.size > 5 * 1024 * 1024) return 'Image must be 5 MB or smaller.';
  return null;
}

function _applyImageFile(file) {
  var err = _validateImageFile(file);
  if (err) { showToast(err); return; }
  _selectedImageFile = file;
  var reader = new FileReader();
  reader.onload = function (e) {
    document.getElementById('img-preview').src = e.target.result;
    document.getElementById('img-preview-wrap').style.display = 'block';
    document.getElementById('img-placeholder').style.display = 'none';
    document.getElementById('img-filename').textContent = file.name + ' (' + (file.size / 1024).toFixed(1) + ' KB)';
  };
  reader.readAsDataURL(file);
}

function imgSelected(event) {
  var file = event.target.files[0];
  if (file) _applyImageFile(file);
}

function imgDragOver(event) {
  event.preventDefault();
  document.getElementById('img-upload-area').classList.add('drag-over');
}
function imgDragLeave(event) {
  document.getElementById('img-upload-area').classList.remove('drag-over');
}
function imgDrop(event) {
  event.preventDefault();
  document.getElementById('img-upload-area').classList.remove('drag-over');
  var file = event.dataTransfer.files[0];
  if (file) _applyImageFile(file);
}

function imgRemove() {
  _selectedImageFile = null;
  document.getElementById('listing-image').value = '';
  document.getElementById('img-preview').src = '';
  document.getElementById('img-preview-wrap').style.display = 'none';
  document.getElementById('img-placeholder').style.display = '';
  document.getElementById('img-filename').textContent = '';
}

function _imageToBase64(file) {
  return new Promise(function (resolve, reject) {
    if (!file) { resolve(null); return; }
    var reader = new FileReader();
    reader.onload = function (e) { resolve(e.target.result); };
    reader.onerror = function () { reject(new Error('Failed to read image.')); };
    reader.readAsDataURL(file);
  });
}

/* ══ MY LISTINGS ══════════════════════════════════════════════ */
var _myListings = [];

async function loadMyListings() {
  try {
    _myListings = await apiGetMyListings();
    setEl('my-total', _myListings.length);
    setEl('my-pending', _myListings.filter(function (l) { return l.status === 'Pending'; }).length);
    setEl('my-approved', _myListings.filter(function (l) { return l.status === 'Approved'; }).length);
    setEl('my-rejected', _myListings.filter(function (l) { return l.status === 'Rejected'; }).length);
    renderMyListings(_myListings);
  } catch (e) { showToast('Could not load listings: ' + e.message); }
}

function renderMyListings(listings) {
  var grid = document.getElementById('my-listings-grid');
  if (!listings.length) {
    grid.innerHTML = '<div style="text-align:center;padding:40px;color:var(--gray)">No listings yet. Post your first deal above!</div>';
    return;
  }
  var bgs = ['bg1', 'bg2', 'bg3', 'bg4', 'bg5', 'bg6'];
  var sColors = { Pending: '#B45309', Approved: 'var(--green)', Rejected: 'var(--red)' };
  var sBgs = { Pending: '#FEF9EE', Approved: '#E8F5EE', Rejected: '#FEF0EC' };
  var sIcons = {
    Pending: '<i class="bi bi-hourglass-split"></i>',
    Approved: '<i class="bi bi-check-circle-fill"></i>',
    Rejected: '<i class="bi bi-x-circle-fill"></i>'
  };

  grid.innerHTML = listings.map(function (l, idx) {
    var st = l.status || 'Pending';
    var sc = sColors[st] || 'var(--gray)';
    var sb = sBgs[st] || '#F3F4F6';
    var si = sIcons[st] || '';
    var pct = l.pct || Math.round((1 - l.disc_price / l.orig_price) * 100) || 0;
    var icn = _typeIcons[l.type] || _typeIcons['Other'];
    var bg = bgs[idx % bgs.length];

    var featBadge = l.featured
      ? '<div style="position:absolute;top:10px;left:10px;background:var(--amber);color:#111;font-size:10px;font-weight:700;padding:3px 9px;border-radius:50px"><i class="bi bi-star-fill"></i> Featured</div>'
      : '';
    var pendingNote = st === 'Pending'
      ? '<div style="font-size:11px;color:#B45309;background:#FEF9EE;padding:6px 10px;border-radius:6px;margin-bottom:8px"><i class="bi bi-hourglass-split"></i> Awaiting admin approval</div>'
      : '';
    var rejectedNote = st === 'Rejected'
      ? '<div style="font-size:11px;color:var(--red);background:#FEF0EC;padding:6px 10px;border-radius:6px;margin-bottom:8px"><i class="bi bi-x-circle-fill"></i> Rejected. Edit and resubmit.</div>'
      : '';

    // Show uploaded photo if available, otherwise fall back to icon
    var cardImg = (l.image || l.image_url)
      ? '<div class="card-img" style="background:#f1f5f9;padding:0;"><img src="' + escHtml(l.image || l.image_url) + '" alt=""/></div>'
      : '<div class="card-img ' + bg + '">' + icn + '</div>';

    return '<div class="food-card" style="position:relative">'
      + '<div style="position:absolute;top:10px;right:10px;background:' + sb + ';color:' + sc + ';font-size:10px;font-weight:700;padding:3px 9px;border-radius:50px">' + si + ' ' + st + '</div>'
      + featBadge
      + cardImg
      + '<div class="card-body">'
      + '<h3 style="font-size:14px">' + escHtml(l.item) + '</h3>'
      + '<div class="card-vendor"><i class="bi bi-shop"></i> ' + escHtml(l.business) + '</div>'
      + '<div style="font-size:11px;color:var(--gray);margin-bottom:6px"><i class="bi bi-geo-alt-fill"></i> ' + escHtml(l.location || '—') + '</div>'
      + '<div class="price-row" style="margin-bottom:6px"><span class="price-new">₱' + l.disc_price + '</span><span class="price-old">₱' + l.orig_price + '</span><span class="discount-badge">-' + pct + '%</span></div>'
      + (l.quantity ? '<div style="font-size:11px;font-weight:600;color:#1D4ED8;background:#EFF6FF;padding:3px 10px;border-radius:50px;display:inline-block;margin-bottom:8px"><i class="bi bi-stack"></i> ' + l.quantity + ' available</div>' : '')
      + pendingNote + rejectedNote
      + '<div class="action-btns"><button class="btn btn-xs btn-red" onclick="deleteListing(\'' + l.id + '\')"><i class="bi bi-trash3-fill"></i> Remove</button></div>'
      + '</div>'
      + '</div>';
  }).join('');
}

async function deleteListing(id) {
  if (!confirm('Remove this listing?')) return;
  try {
    await apiDeleteListing(id);
    showToast('Listing removed.');
    loadMyListings();
  } catch (e) { showToast('Error: ' + e.message); }
}

/* ══ POST LISTING ═════════════════════════════════════════════ */
async function postListing() {
  var flds = ['biz-name', 'biz-type', 'item-name', 'orig-price', 'disc-price', 'location'];
  var vals = {}, errs = [];
  flds.forEach(function (id) {
    var el = document.getElementById(id);
    el.classList.remove('input-error');
    vals[id] = el.value.trim();
    if (!vals[id]) { el.classList.add('input-error'); errs.push(id); }
  });
  if (errs.length) { showToast('Fill in all highlighted fields.'); document.getElementById(errs[0]).focus(); return; }

  var origP = parseFloat(vals['orig-price']), discP = parseFloat(vals['disc-price']);
  if (discP >= origP) {
    document.getElementById('disc-price').classList.add('input-error');
    showToast('Discounted price must be lower than original.');
    return;
  }

  var timeStr = document.getElementById('pickup-time').value || '20:00';
  var tParts = timeStr.split(':');
  var pTime = new Date();
  pTime.setHours(parseInt(tParts[0],10), parseInt(tParts[1],10), 0, 0);
  if (new Date() >= pTime) {
    document.getElementById('pickup-time').classList.add('input-error');
    showToast('Pickup closing time has already passed today.');
    return;
  }

  var btn = document.getElementById('post-btn');
  btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Posting…';
  btn.disabled = true;
  btn.style.opacity = '.7';

  try {
    var imageData = _selectedImageFile ? await _imageToBase64(_selectedImageFile) : null;

    await apiPostListing({
      item: vals['item-name'],
      business: vals['biz-name'],
      type: vals['biz-type'],
      orig_price: origP,
      disc_price: discP,
      location: vals['location'],
      pickup_time: fmtTime(document.getElementById('pickup-time').value || '20:00'),
      image: imageData
    });

    flds.forEach(function (id) { document.getElementById(id).value = ''; });
    document.getElementById('pickup-time').value = '20:00';
    document.getElementById('biz-type').selectedIndex = 0;
    imgRemove();

    showToast('Listing submitted! Pending admin approval.');
    dashTab('listings', document.querySelector('[onclick*="listings"]'));
    loadMyListings();
  } catch (e) { showToast('Error: ' + e.message); }

  btn.innerHTML = '<i class="bi bi-check-circle-fill"></i> Post Listing Now';
  btn.disabled = false;
  btn.style.opacity = '1';
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
  setEl('profile-name', currentUser.name);
  setEl('profile-email', currentUser.email);
  setEl('profile-status', currentUser.status || 'Pending');
  setEl('profile-biz-type', currentUser.biz_type || '\u2014');
  setEl('profile-location', currentUser.location || '\u2014');
  setEl('profile-permit', currentUser.permit || 'Not provided');
  setEl('profile-joined', fmtDate(currentUser.joined_at));
  setEl('profile-login', fmtDate(currentUser.last_login));
  setEl('profile-id', currentUser.id ? currentUser.id.slice(0, 16) + '\u2026' : '\u2014');
  // Load saved avatar
  var savedPhoto = localStorage.getItem('fs_avatar_' + currentUser.id);
  if (savedPhoto) _applyAvatar(savedPhoto);
  // Hide verification hint if already verified
  var hint = document.getElementById('verify-hint');
  if (hint) hint.style.display = (currentUser.status === 'Verified' || currentUser.status === 'Active') ? 'none' : '';
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
    var roleLabel = (currentUser && currentUser.role === 'seller') ? 'Sellers Only' : 'Buyers Only';
    var mine = notifs.filter(function (n) {
      return n.target === 'All Users' || n.target === roleLabel || n.target === ('personal:' + currentUser.id);
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
      return '<div style="display:flex;gap:12px;padding:12px 16px;border-bottom:1px solid #F1F5F9;background:' + (isNew ? '#EFF6FF' : '#fff') + ';align-items:flex-start">'
        + '<div style="width:32px;height:32px;border-radius:50%;background:' + (isNew ? '#DBEAFE' : '#F1F5F9') + ';display:flex;align-items:center;justify-content:center;flex-shrink:0">'
        + '<i class="bi ' + ic + '" style="color:' + (isNew ? '#1D4ED8' : '#64748B') + ';font-size:14px"></i></div>'
        + '<div style="flex:1"><div style="font-size:13px;font-weight:' + (isNew ? '600' : '400') + ';color:#1E293B;line-height:1.4">' + escHtml(n.msg) + '</div>'
        + '<div style="font-size:11px;color:#94A3B8;margin-top:3px" title="' + (n.created_at ? new Date(n.created_at).toLocaleString('en-PH') : '') + '">' + timeAgo(n.created_at) + (isNew ? ' &nbsp;<span style="background:#1D4ED8;color:#fff;font-size:9px;padding:1px 6px;border-radius:50px">NEW</span>' : '') + '</div>'
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
  if (!currentUser) { goLogin(); return; }
  if (currentUser.role === 'admin') { goAdmin(); return; }
  if (currentUser.role === 'buyer') { goBuyer(); return; }

  // ── Suspension check ──────────────────────────────────────
  if (currentUser.status === 'Suspended') {
    var liftDate = currentUser.suspended_until ? new Date(currentUser.suspended_until) : null;
    // Auto-lift only if there IS a date AND it's already passed
    var alreadyLifted = liftDate && liftDate <= new Date();
    if (!alreadyLifted) {
      var wall = document.getElementById('suspension-wall');
      var untilEl = document.getElementById('suspend-wall-until');
      if (wall) wall.style.display = 'flex';
      if (untilEl) {
        untilEl.textContent = liftDate
          ? 'Suspended until ' + liftDate.toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short' })
          : 'Account suspended — contact admin@freshsave.com for details.';
      }
      return; // Block rest of dashboard
    }
  }
  // ─────────────────────────────────────────────────────────

  document.getElementById('seller-greeting').textContent = 'Hi, ' + currentUser.name;
  if (currentUser.status === 'Pending') {
    var warn = document.getElementById('pending-warning');
    if (warn) warn.style.display = 'block';
  }
  renderProfile();
  loadMyListings();
  loadUserNotifs();
  setInterval(loadUserNotifs, 30000);

  var pt = document.getElementById('pickup-time');
  if (pt) {
    pt.addEventListener('input', function (e) {
      var tParts = e.target.value.split(':');
      var pTime = new Date();
      pTime.setHours(parseInt(tParts[0], 10), parseInt(tParts[1], 10), 0, 0);
      if (new Date() >= pTime) e.target.classList.add('input-error');
      else e.target.classList.remove('input-error');
    });
  }
})();