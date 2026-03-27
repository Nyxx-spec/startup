// frontend/js/landing.js — Landing page logic

var _typeIcons = {
  'Bakery':      '<i class="bi bi-cake2"         style="font-size:2.6rem"></i>',
  'Restaurant':  '<i class="bi bi-egg-fried"      style="font-size:2.6rem"></i>',

  'Café':        '<i class="bi bi-cup-hot-fill"   style="font-size:2.6rem"></i>',
  'Pizzeria':    '<i class="bi bi-pie-chart-fill" style="font-size:2.6rem"></i>',
  'Other':       '<i class="bi bi-basket-fill"    style="font-size:2.6rem"></i>'
};

/* ── Impact Stats ─────────────────────────────────────────── */
function _countUp(el, target, duration, format) {
  if (!el) return;
  var start = 0, step = Math.ceil(duration / 60);
  var interval = setInterval(function () {
    start += Math.ceil(target / (duration / step));
    if (start >= target) { start = target; clearInterval(interval); }
    el.textContent = format(start);
  }, step);
}

function _fmtPeso(n) {
  if (n >= 1000) return '₱' + (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return '₱' + Math.round(n).toLocaleString();
}

function _fmtCo2(kg) {
  if (kg >= 1000) return (kg / 1000).toFixed(2) + ' t';
  return kg + ' kg';
}

async function loadImpactStats() {
  var stats = null;
  try { stats = await apiGetImpactStats(); } catch (e) {}
  if (!stats) return; // silently skip if DB unavailable

  var elMeals   = document.getElementById('stat-meals');
  var elUsers   = document.getElementById('stat-users');
  var elCo2     = document.getElementById('stat-co2');
  var elSavings = document.getElementById('stat-savings');

  _countUp(elMeals,   stats.meals,   1200, function(n) { return n.toLocaleString(); });
  _countUp(elUsers,   stats.users,   1200, function(n) { return n.toLocaleString(); });
  _countUp(elCo2,     stats.co2Kg,   1200, _fmtCo2);
  _countUp(elSavings, stats.savings, 1200, _fmtPeso);
}

/* ── Featured Deals ───────────────────────────────────────── */
async function loadFeaturedDeals() {
  try {
    var listings = await apiGetListings();
    var featured = listings.filter(function(l){ return l.featured; }).slice(0, 3);
    if (!featured.length) featured = listings.slice(0, 3);
    renderPreviewCards(featured);
  } catch (e) {
    var grid = document.getElementById('preview-grid');
    if (grid) grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--gray)">Could not load deals at this time.</div>';
  }
}

function renderPreviewCards(listings) {
  var grid = document.getElementById('preview-grid');
  if (!grid) return;
  if (!listings || !listings.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--gray)">No featured deals today. Check back later!</div>';
    return;
  }
  var bgs = ['bg1','bg2','bg3'];
  grid.innerHTML = listings.map(function (l, idx) {
    var pct = l.pct || Math.round((1 - l.disc_price / l.orig_price) * 100) || 0;
    var icn = _typeIcons[l.type] || _typeIcons['Other'];
    var cardImg = (l.image || l.image_url)
      ? '<div class="card-img" style="background:#f1f5f9;padding:0;"><img src="' + escHtml(l.image || l.image_url) + '" alt=""/></div>'
      : '<div class="card-img ' + bgs[idx] + '">' + icn + '</div>';
    return '<div class="food-card">'
      + (l.featured ? '<div class="featured-badge"><i class="bi bi-star-fill"></i> Featured</div>' : '')
      + cardImg
      + '<div class="card-body"><h3>' + escHtml(l.item) + '</h3>'
      + '<div class="card-vendor"><i class="bi bi-shop"></i> ' + escHtml(l.business) + '</div>'
        + '<div class="card-footer" style="flex-direction:column;align-items:flex-start;gap:12px"><div class="price-row" style="width:100%">'
          + '<span class="price-new">₱' + l.disc_price + '</span>'
          + '<span class="price-old">₱' + l.orig_price + '</span>'
          + '<span class="discount-badge">-' + pct + '%</span>'
          + '<button class="card-btn" style="margin-left:auto;padding:6px 14px;font-size:12px" onclick="goBrowse()">View More</button>'
        + '</div><div class="timer" data-time="' + (l.pickup_time||'20:00') + '" style="font-size:11px;padding:3px 8px"><i class="bi bi-clock-fill"></i> <span class="time-text">Closes ' + escHtml(l.pickup_time||'20:00') + '</span></div></div></div></div>';
  }).join('');
  if (window._timerIntL) clearInterval(window._timerIntL);
  window._timerIntL = setInterval(updateAllTimersLanding, 60000);
  updateAllTimersLanding();
}

function updateAllTimersLanding() {
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
    if (diffMs <= 0) {
      if (txtEl) txtEl.textContent = 'Expired';
      el.style.color = 'var(--gray)'; el.style.background = '#F1F5F9';
    } else {
      var diffH = Math.floor(diffMs / 3600000), diffM = Math.floor((diffMs % 3600000) / 60000);
      if (txtEl) txtEl.textContent = 'Closes in ' + (diffH > 0 ? diffH + 'h ' : '') + diffM + 'm';
    }
  });
}

(async function () {
  await loadSession();
  updateNavbar();
  loadFeaturedDeals();
  loadImpactStats();
})();


