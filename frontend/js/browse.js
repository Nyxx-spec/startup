// frontend/js/browse.js — Buyer browse page (login-required)

/* ══ AUTH GUARD ════════════════════════════════════════════════ */
function showLoginModal() { goLogin(); return; }
function closeModal() {}

/* ══ ICON MAP ═════════════════════════════════════════════════ */
var _typeIcons = {
  'Bakery':      '<i class="bi bi-cake2"         style="font-size:2.6rem"></i>',
  'Restaurant':  '<i class="bi bi-egg-fried"      style="font-size:2.6rem"></i>',

  'Café':        '<i class="bi bi-cup-hot-fill"   style="font-size:2.6rem"></i>',
  'Pizzeria':    '<i class="bi bi-pie-chart-fill" style="font-size:2.6rem"></i>',
  'Other':       '<i class="bi bi-basket-fill"    style="font-size:2.6rem"></i>'
};

/* ══ LISTINGS ═════════════════════════════════════════════════ */
var _allListings = [];

async function loadListings() {
  var grid = document.getElementById('cards-grid');
  grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:48px;color:var(--gray)">Loading deals…</div>';
  try {
    _allListings = await apiGetListings();
    applyFilters();
  } catch (e) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:48px;color:var(--gray)">Could not load listings.</div>';
  }
}

function applyFilters() {
  var type   = document.getElementById('active-filter') ? document.getElementById('active-filter').value : 'all';
  var search = document.getElementById('search-input')  ? document.getElementById('search-input').value.toLowerCase() : '';
  var filtered = _allListings.filter(function (l) {
    return (type === 'all' || l.type === type)
        && (!search || (l.item||'').toLowerCase().includes(search) || (l.business||'').toLowerCase().includes(search));
  });
  renderCards(filtered);
}

function filterCards(pill, type) {
  document.querySelectorAll('.filter-pill').forEach(function (p) { p.classList.remove('active'); });
  pill.classList.add('active');
  document.getElementById('active-filter').value = type;
  applyFilters();
}

function renderCards(listings) {
  var grid = document.getElementById('cards-grid');
  if (!listings.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:48px;color:var(--gray)">No listings found.</div>';
    return;
  }
  var bgs = ['bg1','bg2','bg3','bg4','bg5','bg6'];
  grid.innerHTML = listings.map(function (l, idx) {
    var bg  = bgs[idx % bgs.length];
    var icn = _typeIcons[l.type] || _typeIcons['Other'];
    var pct = l.pct || Math.round((1 - l.disc_price / l.orig_price) * 100) || 0;
    var fb  = l.featured ? '<div class="featured-badge"><i class="bi bi-star-fill"></i> Featured</div>' : '';
    var cardImg = (l.image || l.image_url)
      ? '<div class="card-img" style="background:#f1f5f9;padding:0;"><img src="' + escHtml(l.image || l.image_url) + '" alt=""/></div>'
      : '<div class="card-img ' + bg + '">' + icn + '</div>';
    return '<div class="food-card" data-id="' + l.id + '" data-item="' + escHtml(l.item) + '" data-biz="' + escHtml(l.business) + '" data-price="\u20b1' + l.disc_price + '">' 
      + fb
      + cardImg
      + '<div class="card-body">'
        + '<h3>' + escHtml(l.item) + '</h3>'
        + '<div class="card-vendor"><i class="bi bi-shop"></i> ' + escHtml(l.business) + '</div>'
        + '<div style="font-size:11px;color:var(--gray);margin-bottom:4px"><i class="bi bi-geo-alt-fill"></i> ' + escHtml(l.location||'\u2014') + '</div>'
        + (l.quantity ? '<div style="font-size:11px;font-weight:600;color:#1D4ED8;background:#EFF6FF;padding:2px 9px;border-radius:50px;display:inline-block;margin-bottom:6px"><i class="bi bi-stack"></i> ' + l.quantity + ' left</div>' : '')
        + '<div class="card-footer"><div><div class="price-row">'
          + '<span class="price-new">\u20b1' + l.disc_price + '</span>'
          + '<span class="price-old">\u20b1' + l.orig_price + '</span>'
          + '<span class="discount-badge">-' + pct + '%</span>'
        + '</div><div class="timer" data-time="' + (l.pickup_time||'20:00') + '"><i class="bi bi-clock-fill"></i> <span class="time-text">Closes ' + escHtml(l.pickup_time||'20:00') + '</span></div></div>'
        + '<button class="card-btn reserve-btn" onclick="reserveItem(this)">Reserve</button>'
      + '</div></div></div>';
  }).join('');
  if (window._timerInt) clearInterval(window._timerInt);
  window._timerInt = setInterval(updateAllTimers, 60000);
  updateAllTimers();
}

function updateAllTimers() {
  var now = new Date();
  document.querySelectorAll('.timer[data-time]').forEach(function(el) {
    var t = el.getAttribute('data-time') || '20:00';
    var isPM = t.toLowerCase().indexOf('pm') > -1;
    var pts = t.replace(/[^0-9:]/g, '').split(':');
    var h = parseInt(pts[0],10) || 0, m = parseInt(pts[1],10) || 0;
    if (isPM && h < 12) h += 12;
    if (!isPM && t.toLowerCase().indexOf('am') > -1 && h === 12) h = 0;
    
    var target = new Date(); target.setHours(h, m, 0, 0);
    var diffMs = target - now;
    var txtEl = el.querySelector('.time-text');
    var btn = el.closest('.food-card').querySelector('.reserve-btn');
    if (diffMs <= 0) {
      if (txtEl) txtEl.textContent = 'Expired';
      el.style.color = 'var(--gray)'; el.style.background = '#F1F5F9';
      if (btn) { btn.disabled = true; btn.textContent = 'Closed'; }
    } else {
      var diffH = Math.floor(diffMs / 3600000), diffM = Math.floor((diffMs % 3600000) / 60000);
      if (txtEl) txtEl.textContent = 'Closes in ' + (diffH > 0 ? diffH + 'h ' : '') + diffM + 'm';
    }
  });
}

/* ══ RESERVE ══════════════════════════════════════════════════ */
var _reserveContext = null;

async function reserveItem(btn) {
  if (!currentUser) { goLogin(); return; }
  if (currentUser.role !== 'buyer') { showToast('Only buyers can reserve items.'); return; }
  var card = btn.closest('.food-card');
  _reserveContext = {
    btn: btn,
    item: card.dataset.item,
    biz: card.dataset.biz,
    price: card.dataset.price
  };
  var radios = document.getElementsByName('payment-method');
  if (radios.length) radios[0].checked = true;
  document.getElementById('modal-payment-section').style.display = 'flex';
}

async function confirmReservation() {
  if (!_reserveContext) return;
  var sel = document.querySelector('input[name="payment-method"]:checked');
  var method = sel ? sel.value : 'Cash on Pickup / Pay at Store';
  
  var btn = _reserveContext.btn;
  var confirmBtn = document.getElementById('btn-confirm-reserve');
  confirmBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Reserving…'; 
  confirmBtn.disabled = true;
  
  try {
    await apiReserveItem(_reserveContext.item, _reserveContext.biz, _reserveContext.price, method);
    btn.innerHTML = '<i class="bi bi-check-lg"></i> Reserved!'; btn.style.background = '#52996E'; btn.disabled = true;
    showToast('Reserved! Check My Orders for pickup details.');
    document.getElementById('modal-payment-section').style.display = 'none';
  } catch (e) {
    showToast('Error: ' + e.message, '#E76F51');
  }
  
  confirmBtn.innerHTML = '<i class="bi bi-check-lg"></i> Confirm Reservation'; 
  confirmBtn.disabled = false;
  _reserveContext = null;
}

/* ══ INIT ═════════════════════════════════════════════════════ */
(async function () {
  await loadSession();
  if (!currentUser) { goLogin(); return; }

  var g = document.getElementById('browse-greeting');
  if (g) g.textContent = 'Hi, ' + currentUser.name;

  // Show correct role badge and back button
  var badgeEl = document.querySelector('.badge.badge-buyer');
  if (badgeEl && currentUser.role !== 'buyer') {
    badgeEl.textContent = currentUser.role.toUpperCase();
    badgeEl.className = 'badge badge-' + currentUser.role;
  }
  // Add a "Back to Dashboard" button for sellers/admins
  var userInfo = document.querySelector('.admin-user-info');
  if (userInfo && currentUser.role !== 'buyer') {
    var dashBtn = document.createElement('button');
    dashBtn.className = 'btn btn-sm';
    dashBtn.style.cssText = 'background:rgba(255,255,255,.15);color:#fff;border:1px solid rgba(255,255,255,.3);margin-right:6px';
    dashBtn.innerHTML = '<i class="bi bi-grid-1x2-fill"></i> Dashboard';
    dashBtn.onclick = function() { currentUser.role === 'admin' ? goAdmin() : goSeller(); };
    userInfo.insertBefore(dashBtn, userInfo.firstChild);
  }

  loadListings();
})();
