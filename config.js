// frontend/js/landing.js — Landing page logic

var _typeIcons = {
  'Bakery':      '<i class="bi bi-cake2"         style="font-size:2.6rem"></i>',
  'Restaurant':  '<i class="bi bi-egg-fried"      style="font-size:2.6rem"></i>',
  'Supermarket': '<i class="bi bi-cart4"          style="font-size:2.6rem"></i>',
  'Café':        '<i class="bi bi-cup-hot-fill"   style="font-size:2.6rem"></i>',
  'Pizzeria':    '<i class="bi bi-pie-chart-fill" style="font-size:2.6rem"></i>',
  'Other':       '<i class="bi bi-basket-fill"    style="font-size:2.6rem"></i>'
};

async function loadFeaturedDeals() {
  try {
    var listings = await apiGetListings();
    var featured = listings.filter(function(l){ return l.featured; }).slice(0, 3);
    if (!featured.length) featured = listings.slice(0, 3);
    renderPreviewCards(featured);
  } catch (e) { /* silent — static placeholder */ }
}

function renderPreviewCards(listings) {
  var grid = document.getElementById('preview-grid');
  if (!grid || !listings.length) return;
  var bgs = ['bg1','bg2','bg3'];
  grid.innerHTML = listings.map(function (l, idx) {
    var pct = l.pct || Math.round((1 - l.disc_price / l.orig_price) * 100) || 0;
    var icn = _typeIcons[l.type] || _typeIcons['Other'];
    return '<div class="food-card">'
      + (l.featured ? '<div class="featured-badge"><i class="bi bi-star-fill"></i> Featured</div>' : '')
      + '<div class="card-img ' + bgs[idx] + '">' + icn + '</div>'
      + '<div class="card-body"><h3>' + escHtml(l.item) + '</h3>'
      + '<div class="card-vendor"><i class="bi bi-shop"></i> ' + escHtml(l.business) + '</div>'
      + '<div class="card-footer"><div><div class="price-row">'
        + '<span class="price-new">₱' + l.disc_price + '</span>'
        + '<span class="price-old">₱' + l.orig_price + '</span>'
        + '<span class="discount-badge">-' + pct + '%</span>'
      + '</div></div>'
      + '<button class="card-btn" onclick="goBrowse()">View More</button></div></div></div>';
  }).join('');
}

(async function () {
  await loadSession();
  updateNavbar();
  loadFeaturedDeals();
})();
