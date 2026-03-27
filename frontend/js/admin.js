// frontend/js/admin.js
// All admin dashboard logic for pages/admin.html.

/* ══ STATE ════════════════════════════════════════════════════ */
var adminListingFilter = 'all';
var adminOrderFilter = 'all';
var _lastOrderCount = 0;
var editingUid = null;
var editingLid = null;
var currentVerifySellerId = null;
var currentReportId = null;
var currentDisputeId = null;

/* ══ ADMIN NAV ════════════════════════════════════════════════ */
function adminTab(section, el) {
  document.querySelectorAll('.admin-nav-item').forEach(function (i) { i.classList.remove('active'); });
  document.querySelectorAll('.admin-section').forEach(function (s) { s.classList.remove('active'); });
  if (el) el.classList.add('active');
  document.getElementById('admin-' + section).classList.add('active');
  refreshAdminData();
}

/* ══ REFRESH ALL ADMIN DATA ══════════════════════════════════ */
async function refreshAdminData() {
  try {
    var results = await Promise.all([
      apiGetStats(),
      apiGetAllListings(),
      apiGetAllReservations(),
      apiGetUsers(),
      apiGetReports(),
      apiGetNotifications(),
      apiGetLog()
    ]);
    var stats = results[0];
    var listings = results[1];
    var orders = results[2];
    var users = results[3];
    var reports = results[4];
    var notifs = results[5];
    var log = results[6];

    // Stats
    setEl('stat-users', stats.totalUsers);
    setEl('stat-sellers', stats.totalSellers);
    setEl('stat-listings', stats.totalListings);
    setEl('stat-reservations', stats.totalOrders);
    setEl('stat-pending', stats.pendingSellers);
    setEl('stat-open-reports', stats.openReports);
    setEl('stat-actions', log.length);
    setEl('ord-total', stats.totalOrders);
    setEl('ord-pending', stats.ord_pending);
    setEl('ord-pickedup', stats.ord_pickedup);
    setEl('ord-cancelled', stats.ord_cancelled);

    setEl('lst-pending', listings.filter(function (l) { return l.status === 'Pending'; }).length);
    setEl('lst-approved', listings.filter(function (l) { return l.status === 'Approved'; }).length);
    setEl('lst-rejected', listings.filter(function (l) { return l.status === 'Rejected'; }).length);
    setEl('lst-featured', listings.filter(function (l) { return l.featured; }).length);

    setEl('rep-open', reports.filter(function (r) { return r.status === 'Open'; }).length);
    setEl('rep-resolved', reports.filter(function (r) { return r.status !== 'Open'; }).length);
    setEl('rep-warnings', reports.filter(function (r) { return r.status === 'Warning Issued'; }).length);

    // Render everything
    renderRecentUsers(users);
    renderUsersTable(users);
    renderSellersTable(users);
    renderAdminListingCards(listings);
    renderAdminOrderCards(orders);
    renderRecentOrders(orders);
    renderReportsTable(reports);
    renderPaymentsTable(orders);
    renderNotifList(notifs);
    renderSecurityLog(log);
    checkNewOrders(stats.totalOrders);

  } catch (e) {
    console.error('Admin data refresh failed:', e);
    showToast('Could not load admin data: ' + e.message, '#E76F51');
  }
}

/* ══ RECENT USERS (dashboard) ════════════════════════════════ */
function renderRecentUsers(users) {
  var tb = document.getElementById('recent-users-tbody'); if (!tb) return;
  var list = (users || []).slice(0, 6);
  if (!list.length) { tb.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--gray);padding:20px">No users yet.</td></tr>'; return; }
  tb.innerHTML = list.map(function (u) {
    var st = u.status || 'Active';
    var bc = st === 'Active' ? 'active' : st === 'Suspended' ? 'suspended' : 'pending';
    return '<tr>'
      + '<td><strong>' + escHtml(u.name) + '</strong></td>'
      + '<td style="font-size:12px">' + escHtml(u.email) + '</td>'
      + '<td><span class="badge badge-' + u.role + '">' + u.role + '</span></td>'
      + '<td>' + fmtDate(u.joined_at) + '</td>'
      + '<td><span class="badge badge-' + bc + '">' + st + '</span></td>'
      + '</tr>';
  }).join('');
}

/* ══ USERS TABLE ══════════════════════════════════════════════ */
function renderUsersTable(users) {
  var q = (document.getElementById('user-search') || { value: '' }).value.toLowerCase();
  var rf = (document.getElementById('user-role-filter') || { value: '' }).value;
  var sf = (document.getElementById('user-status-filter') || { value: '' }).value;
  var filtered = (users || []).filter(function (u) {
    return (!q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      && (!rf || u.role === rf)
      && (!sf || u.status === sf);
  });
  var tb = document.getElementById('users-tbody'); if (!tb) return;
  if (!filtered.length) { tb.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--gray);padding:20px">No users found.</td></tr>'; return; }
  tb.innerHTML = filtered.map(function (u, i) {
    var isSelf = currentUser && u.id === currentUser.id;
    var st = u.status || 'Active';
    var bc = st === 'Active' ? 'active' : st === 'Suspended' ? 'suspended' : 'pending';
    var acts = '';
    if (!isSelf) {
      acts = '<button class="btn btn-xs btn-admin" onclick="openEditUser(\'' + u.id + '\')" title="Edit"><i class="bi bi-pencil-square"></i></button>';
      if (st !== 'Suspended') acts += '<button class="btn btn-xs btn-red"   onclick="suspendUser(\'' + u.id + '\',\'' + escHtml(u.name).replace(/'/g, "\\'") + '\')" title="Suspend"><i class="bi bi-slash-circle-fill"></i></button>';
      else acts += '<button class="btn btn-xs btn-green" onclick="unsuspendUser(\'' + u.id + '\')" title="Restore"><i class="bi bi-check-circle-fill"></i></button>';
      acts += '<button class="btn btn-xs" style="background:#6B7280;color:#fff" onclick="deleteUser(\'' + u.id + '\')" title="Delete"><i class="bi bi-trash3-fill"></i></button>';
    } else { acts = '<em style="font-size:12px;color:var(--gray)">You</em>'; }
    return '<tr><td>' + (i + 1) + '</td><td><strong>' + escHtml(u.name) + '</strong></td>'
      + '<td style="font-size:12px">' + escHtml(u.email) + '</td>'
      + '<td><span class="badge badge-' + u.role + '">' + u.role + '</span></td>'
      + '<td><span class="badge badge-' + bc + '">' + st + '</span></td>'
      + '<td>—</td><td>' + fmtDate(u.joined_at) + '</td>'
      + '<td><div class="action-btns">' + acts + '</div></td></tr>';
  }).join('');
}

/* ══ SELLERS TABLE ════════════════════════════════════════════ */
function renderSellersTable(users) {
  var sf = (document.getElementById('seller-status-filter') || { value: '' }).value;
  var sellers = (users || []).filter(function (u) { return u.role === 'seller' && (!sf || u.status === sf); });
  var tb = document.getElementById('sellers-tbody'); if (!tb) return;
  if (!sellers.length) { tb.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--gray);padding:20px">No sellers found.</td></tr>'; return; }
  tb.innerHTML = sellers.map(function (u, i) {
    var st = u.status || 'Pending';
    var bc = st === 'Verified' ? 'verified' : st === 'Suspended' ? 'suspended' : 'pending';
    var permitBadge = u.permit
      ? '<span class="badge badge-active" style="font-size:10px"><i class="bi bi-file-earmark-check-fill"></i> ' + escHtml(u.permit) + '</span>'
      : '<span class="badge badge-pending" style="font-size:10px">No Permit</span>';
    return '<tr><td>' + (i + 1) + '</td><td><strong>' + escHtml(u.name) + '</strong></td>'
      + '<td style="font-size:12px">' + escHtml(u.email) + '</td>'
      + '<td>' + escHtml(u.biz_type || '—') + '</td>'
      + '<td style="font-size:12px">' + escHtml(u.location || '—') + '</td>'
      + '<td>' + permitBadge + '</td>'
      + '<td><span class="badge badge-' + bc + '">' + st + '</span></td>'
      + '<td>' + fmtDate(u.joined_at) + '</td>'
      + '<td><div class="action-btns">'
      + '<button class="btn btn-xs btn-admin" onclick="showVerifyModal(\'' + u.id + '\')" title="Review"><i class="bi bi-search"></i> Review</button>'
      + (st === 'Suspended' ? '<button class="btn btn-xs btn-green" onclick="actOnSellerDirect(\'' + u.id + '\',\'Verified\')">Restore</button>' : '')
      + '</div></td></tr>';
  }).join('');
}

async function actOnSellerDirect(uid, status) {
  try {
    await apiVerifySeller(uid, status);
    showToast(status === 'Verified' ? 'Seller restored!' : 'Seller suspended.', status === 'Verified' ? '#2D6A4F' : '#E76F51');
    refreshAdminData();
  } catch (e) { showToast('Error: ' + e.message, '#E76F51'); }
}

/* ══ REPORTS TABLE ════════════════════════════════════════════ */
var _reportHistoryOpen = false;
var _cachedReports = [];

function renderReportsTable(reports) {
  if (reports) _cachedReports = reports;
  var all = _cachedReports;

  // Split active vs history
  var ACTIVE_STATES  = ['Open', 'Warning Issued'];
  var HISTORY_STATES = ['Resolved', 'Dismissed', 'Seller Removed', 'Refund Issued'];

  var sf = (document.getElementById('report-status-filter') || { value: '' }).value;
  var active = all.filter(function (r) {
    return ACTIVE_STATES.indexOf(r.status || 'Open') !== -1 && (!sf || r.status === sf);
  });
  var history = all.filter(function (r) {
    return ACTIVE_STATES.indexOf(r.status || 'Open') === -1;
  });

  // Update counters
  setEl('rep-removed', all.filter(function (r) { return r.status === 'Seller Removed'; }).length);

  // Render active
  var tb = document.getElementById('reports-tbody'); if (!tb) return;
  if (!active.length) {
    tb.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--gray);padding:20px"><i class="bi bi-check-circle-fill" style="color:var(--green)"></i> No active reports — all clear!</td></tr>';
  } else {
    var acts_colors = { Open: 'var(--red)', 'Warning Issued': '#B45309' };
    var acts_bgs    = { Open: '#FEF0EC',    'Warning Issued': '#FEF9EE' };
    tb.innerHTML = active.map(function (r, i) {
      var st  = r.status || 'Open';
      var sc  = acts_colors[st] || 'var(--gray)';
      var sb  = acts_bgs[st]    || '#F3F4F6';
      var acts = '';
      if (st === 'Open' || st === 'Warning Issued') {
        acts = '<button class="btn btn-xs btn-green" onclick="showReportModal(\'' + r.id + '\')" title="Resolve"><i class="bi bi-scale"></i> Resolve</button>';
        acts += '<button class="btn btn-xs btn-amber" onclick="issueWarning(\'' + r.id + '\')" title="Warn"><i class="bi bi-exclamation-triangle-fill"></i> Warn</button>';
        acts += '<button class="btn btn-xs btn-red"   onclick="removeBadSeller(\'' + r.id + '\')" title="Remove Seller"><i class="bi bi-slash-circle-fill"></i> Remove</button>';
      }
      return '<tr><td>' + (i + 1) + '</td>'
        + '<td style="font-size:12px;font-weight:700">' + escHtml(r.id) + '</td>'
        + '<td>' + escHtml(r.reporter) + '</td>'
        + '<td><strong>' + escHtml(r.against) + '</strong></td>'
        + '<td><span class="badge badge-pending" style="font-size:10px">' + escHtml(r.issue_type) + '</span></td>'
        + '<td style="font-size:12px;color:var(--gray);max-width:180px">' + escHtml((r.details || '').slice(0, 60)) + '…</td>'
        + '<td>' + fmtDate(r.created_at) + '</td>'
        + '<td><span style="display:inline-block;background:' + sb + ';color:' + sc + ';font-size:11px;font-weight:700;padding:3px 10px;border-radius:50px">' + escHtml(st) + '</span></td>'
        + '<td><div class="action-btns">' + acts + '</div></td></tr>';
    }).join('');
  }

  // Render history
  renderReportHistory(history);
}

function renderReportHistory(history) {
  var htb = document.getElementById('reports-history-tbody'); if (!htb) return;
  var cnt = document.getElementById('history-count');
  if (cnt) cnt.textContent = '(' + history.length + ')';

  if (!history.length) {
    htb.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--gray);padding:16px">No resolved reports yet.</td></tr>';
    return;
  }

  var actionLabels = {
    warn:    '<span style="background:#FEF9EE;color:#78350F;border-radius:50px;padding:2px 10px;font-size:11px;font-weight:700"><i class="bi bi-exclamation-triangle-fill"></i> Warning Issued</span>',
    resolve: '<span style="background:#DCFCE7;color:#14532D;border-radius:50px;padding:2px 10px;font-size:11px;font-weight:700"><i class="bi bi-check-circle-fill"></i> Resolved</span>',
    dismiss: '<span style="background:#F1F5F9;color:#334155;border-radius:50px;padding:2px 10px;font-size:11px;font-weight:700"><i class="bi bi-x-circle-fill"></i> Dismissed</span>',
    suspend: '<span style="background:#FEE2E2;color:#7C2D12;border-radius:50px;padding:2px 10px;font-size:11px;font-weight:700"><i class="bi bi-slash-circle-fill"></i> Seller Suspended</span>',
    remove:  '<span style="background:#FEE2E2;color:#7C2D12;border-radius:50px;padding:2px 10px;font-size:11px;font-weight:700"><i class="bi bi-person-x-fill"></i> Seller Removed</span>',
    refund:  '<span style="background:#DBEAFE;color:#1E3A8A;border-radius:50px;padding:2px 10px;font-size:11px;font-weight:700"><i class="bi bi-cash-stack"></i> Refund Issued</span>'
  };

  htb.innerHTML = history.map(function (r, i) {
    var resolvedBadge = actionLabels[r.action] || ('<span style="background:#DCFCE7;color:#14532D;border-radius:50px;padding:2px 10px;font-size:11px;font-weight:700">' + escHtml(r.status) + '</span>');
    return '<tr>'
      + '<td>' + (i + 1) + '</td>'
      + '<td style="font-size:12px;font-weight:700;color:var(--gray)">' + escHtml(r.id) + '</td>'
      + '<td>' + escHtml(r.reporter) + '</td>'
      + '<td><strong>' + escHtml(r.against) + '</strong></td>'
      + '<td><span class="badge badge-pending" style="font-size:10px">' + escHtml(r.issue_type) + '</span></td>'
      + '<td style="font-size:12px;color:var(--gray);max-width:160px">' + escHtml((r.details || '').slice(0, 60)) + '…</td>'
      + '<td style="font-size:12px">' + fmtDate(r.created_at) + '</td>'
      + '<td style="font-size:12px;color:var(--gray)">' + fmtDate(r.updated_at || r.created_at) + '</td>'
      + '<td>' + resolvedBadge + '</td>'
      + '</tr>';
  }).join('');
}

function toggleReportHistory() {
  var wrap = document.getElementById('report-history-wrap');
  var icon = document.getElementById('history-toggle-icon');
  if (!wrap) return;
  _reportHistoryOpen = !_reportHistoryOpen;
  wrap.style.display = _reportHistoryOpen ? 'block' : 'none';
  if (icon) icon.innerHTML = _reportHistoryOpen ? '<i class="bi bi-chevron-up"></i>' : '<i class="bi bi-chevron-down"></i>';
}

/* ══ PAYMENTS TABLE ═══════════════════════════════════════════ */
function renderPaymentsTable(orders) {
  var tb = document.getElementById('payments-tbody'); if (!tb) return;
  var pays = (orders || []).map(function (r) {
    var amt = parseFloat((r.price || '').replace(/[^0-9.]/g, '')) || 0;
    return { id: 'PAY-' + r.id, buyer: r.buyer_name, item: r.item, amount: amt, commission: Math.round(amt * 0.1 * 10) / 10, status: r.status === 'Cancelled' ? 'Cancelled' : r.status === 'Refunded' ? 'Refunded' : 'Completed', date: r.created_at };
  });

  var totalRev = 0, totalComm = 0, monthRev = 0, totalRef = 0;
  var now = new Date();
  pays.forEach(function (p) {
    if (p.status === 'Completed') {
      totalRev += p.amount;
      totalComm += p.commission;
      var d = new Date(p.date);
      if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
        monthRev += p.amount;
      }
    } else if (p.status === 'Refunded') {
      totalRef += p.amount;
    }
  });

  var eTot=document.getElementById('rev-total'), eCom=document.getElementById('rev-comm'), eMon=document.getElementById('rev-month'), eRef=document.getElementById('rev-refunds');
  var fmtMoney = function(n) { return '₱' + (n>=1000 ? (n/1000).toFixed(1).replace(/\.0$/,'')+'K' : Math.round(n)); };
  if(eTot) eTot.innerHTML = fmtMoney(totalRev);
  if(eCom) eCom.innerHTML = fmtMoney(totalComm);
  if(eMon) eMon.innerHTML = fmtMoney(monthRev);
  if(eRef) eRef.innerHTML = fmtMoney(totalRef);

  var sf = (document.getElementById('pay-status-filter') || { value: '' }).value;
  if (sf) pays = pays.filter(function (p) { return p.status === sf; });
  if (!pays.length) { tb.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--gray);padding:20px">No payments.</td></tr>'; return; }
  tb.innerHTML = pays.map(function (p) {
    var bc = p.status === 'Completed' ? 'approved' : p.status === 'Refunded' ? 'rejected' : 'pending';
    return '<tr>'
      + '<td style="font-size:12px;font-weight:700">' + p.id + '</td>'
      + '<td>' + escHtml(p.buyer) + '</td>'
      + '<td>' + escHtml(p.item) + '</td>'
      + '<td><strong>₱' + p.amount + '</strong></td>'
      + '<td style="color:var(--green)">₱' + p.commission + '</td>'
      + '<td>GCash</td>'
      + '<td>' + fmtDate(p.date) + '</td>'
      + '<td><span class="badge badge-' + bc + '">' + p.status + '</span></td>'
      + '</tr>';
  }).join('');
}

/* ══ NOTIFICATIONS ════════════════════════════════════════════ */
function renderNotifList(notifs) {
  var el = document.getElementById('notif-list'); if (!el) return;
  if (!(notifs || []).length) { el.innerHTML = '<p style="text-align:center;color:var(--gray);font-size:14px;padding:20px">No notifications sent yet.</p>'; return; }
  var icons = { deal: '<i class="bi bi-bag-heart-fill"></i>', promo: '<i class="bi bi-stars"></i>', reminder: '<i class="bi bi-clock-fill"></i>', system: '<i class="bi bi-gear-fill"></i>' };
  el.innerHTML = notifs.map(function (n) {
    return '<div class="notif-item"><div class="notif-item-left">'
      + '<div class="notif-icon">' + (icons[n.type] || '<i class="bi bi-bell-fill"></i>') + '</div>'
      + '<div><div class="notif-text">' + escHtml(n.msg) + '</div>'
      + '<div class="notif-time">Sent to: <strong>' + n.target + '</strong> · ' + fmtDate(n.created_at) + '</div></div>'
      + '</div></div>';
  }).join('');
}

async function sendNotification() {
  var msg = document.getElementById('notif-msg').value.trim();
  if (!msg) { showToast('Please enter a message.', '#E76F51'); return; }
  var targetEl = document.getElementById('notif-target');
  var typeEl = document.getElementById('notif-type');
  var targetTxt = targetEl.options[targetEl.selectedIndex].text;
  var typeVal = typeEl.value;
  try {
    await apiSendNotification(msg, targetTxt, typeVal);
    document.getElementById('notif-msg').value = '';
    showToast('Notification sent to ' + targetTxt + '!');
    refreshAdminData();
  } catch (e) { showToast('Error: ' + e.message, '#E76F51'); }
}

/* ══ SECURITY LOG ═════════════════════════════════════════════ */
function renderSecurityLog(log) {
  var tf = (document.getElementById('log-type-filter') || { value: '' }).value;
  var filtered = (log || []).filter(function (l) { return !tf || l.type === tf; });
  var el = document.getElementById('security-log-list'); if (!el) return;
  if (!filtered.length) { el.innerHTML = '<p style="text-align:center;color:var(--gray);font-size:14px;padding:20px">No activity logged.</p>'; return; }
  var logIcons = {
    green: '<i class="bi bi-check-circle-fill" style="color:var(--green)"></i>',
    red: '<i class="bi bi-exclamation-circle-fill" style="color:var(--red)"></i>',
    amber: '<i class="bi bi-exclamation-triangle-fill" style="color:#F59E0B"></i>',
    blue: '<i class="bi bi-info-circle-fill" style="color:#1D4ED8"></i>'
  };
  el.innerHTML = filtered.map(function (l) {
    return '<div class="log-item">'
      + '<div class="log-dot ' + l.type + '"></div>'
      + '<div style="flex:1"><div class="log-text"><span style="margin-right:6px">' + (logIcons[l.type] || '') + '</span>' + escHtml(l.msg) + '</div>'
      + '<div class="log-time">' + fmtDate(l.created_at) + '</div></div>'
      + '</div>';
  }).join('');
}

function exportReport() { showToast('Report exported to CSV.', '#1E3A5F'); }
function exportLog() { showToast('Log exported.', '#1E3A5F'); }

/* ══ ADMIN LISTING CARDS ══════════════════════════════════════ */
function adminFilterListings(pill, type) {
  document.querySelectorAll('#admin-listings .filter-pill').forEach(function (p) { p.classList.remove('active'); });
  pill.classList.add('active');
  adminListingFilter = type;
  refreshAdminData();
}

function renderAdminListingCards(listings) {
  var q = (document.getElementById('admin-listing-search') || { value: '' }).value.toLowerCase();
  var filtered = (listings || []).filter(function (l) {
    var matchQ = !q || (l.item || '').toLowerCase().includes(q) || (l.business || '').toLowerCase().includes(q);
    var matchF = adminListingFilter === 'all' || (adminListingFilter === 'featured' && l.featured) || (l.status === adminListingFilter);
    return matchQ && matchF;
  });
  var grid = document.getElementById('admin-listings-grid'); if (!grid) return;
  if (!filtered.length) { grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:48px;color:var(--gray);font-size:14px">No listings found.</div>'; return; }
  var bgs = ['bg1', 'bg2', 'bg3', 'bg4', 'bg5', 'bg6'];
  var emojis = { Bakery: '🥐', Restaurant: '🍱', Café: '☕', Pizzeria: '🍕', Other: '🍜' };
  grid.innerHTML = filtered.map(function (l, idx) {
    var st = l.status || 'Pending';
    var bg = bgs[idx % bgs.length];
    var em = emojis[l.type] || '🍴';
    var sc = st === 'Approved' ? 'var(--green)' : st === 'Rejected' ? 'var(--red)' : '#B45309';
    var sb = st === 'Approved' ? '#E8F5EE' : st === 'Rejected' ? '#FEF0EC' : '#FEF9EE';
    var pct = l.pct || Math.round((1 - l.disc_price / l.orig_price) * 100) || 0;
    var featBadge = l.featured ? '<div style="position:absolute;top:10px;left:10px;background:var(--amber);color:#111;font-size:10px;font-weight:700;padding:3px 9px;border-radius:50px">⭐ Featured</div>' : '';
    var statusBadge = '<div style="position:absolute;top:10px;right:10px;background:' + sb + ';color:' + sc + ';font-size:10px;font-weight:700;padding:3px 9px;border-radius:50px">' + st + '</div>';
    var approveBtn = st === 'Pending'
      ? '<button class="btn btn-xs btn-green" onclick="approveListing(\'' + l.id + '\')">✓ Approve</button>'
      + '<button class="btn btn-xs btn-red"   onclick="rejectListing(\'' + l.id + '\')">✗ Reject</button>'
      : '';
    var featBtn = l.featured
      ? '<button class="btn btn-xs btn-amber" onclick="featureListing(\'' + l.id + '\', false)">Unfeature</button>'
      : '<button class="btn btn-xs btn-amber" onclick="featureListing(\'' + l.id + '\', true)">⭐ Feature</button>';
    var cardImg = (l.image || l.image_url)
      ? '<div class="card-img" style="background:#f1f5f9;padding:0;"><img src="' + escHtml(l.image || l.image_url) + '" alt=""/></div>'
      : '<div class="card-img ' + bg + '" style="font-size:48px">' + em + '</div>';
    return '<div class="food-card" style="position:relative">'
      + featBadge + statusBadge
      + cardImg
      + '<div class="card-body">'
      + '<h3 style="font-size:14px;font-weight:700;margin-bottom:2px">' + escHtml(l.item) + '</h3>'
      + '<div class="card-vendor">🏪 ' + escHtml(l.business) + '</div>'
      + '<div style="font-size:11px;color:var(--gray);margin-bottom:8px">📍 ' + escHtml(l.location || '—') + ' · ⏰ ' + escHtml(l.pickup_time || '—') + '</div>'
      + '<div class="card-footer" style="margin-bottom:10px"><div class="price-row"><span class="price-new">₱' + l.disc_price + '</span><span class="price-old">₱' + l.orig_price + '</span><span class="discount-badge">-' + pct + '%</span></div></div>'
      + '<div class="action-btns" style="flex-wrap:wrap;gap:5px">'
      + approveBtn
      + '<button class="btn btn-xs btn-admin" onclick="openEditListing(\'' + l.id + '\')">Edit</button>'
      + featBtn
      + '<button class="btn btn-xs" style="background:#6B7280;color:#fff" onclick="adminDelListing(\'' + l.id + '\')">Remove</button>'
      + '</div>'
      + '</div>'
      + '</div>';
  }).join('');
}

/* ══ ADMIN ORDER CARDS ════════════════════════════════════════ */
function adminFilterOrders(pill, type) {
  document.querySelectorAll('#admin-reservations .filter-pill').forEach(function (p) { p.classList.remove('active'); });
  pill.classList.add('active');
  adminOrderFilter = type;
  refreshAdminData();
}

function renderAdminOrderCards(orders) {
  var q = (document.getElementById('admin-order-search') || { value: '' }).value.toLowerCase();
  var filtered = (orders || []).filter(function (r) {
    var matchQ = !q || (r.buyer_name || '').toLowerCase().includes(q) || (r.item || '').toLowerCase().includes(q) || (r.business || '').toLowerCase().includes(q);
    return matchQ && (adminOrderFilter === 'all' || r.status === adminOrderFilter);
  });
  var grid = document.getElementById('admin-orders-grid'); if (!grid) return;
  if (!filtered.length) { grid.innerHTML = '<div style="text-align:center;padding:48px;color:var(--gray);font-size:14px;background:var(--bg-card);border-radius:14px;border:1px solid var(--border)">No orders found.</div>'; return; }
  var statusColors = { 'Reserved': 'var(--green)', 'Picked Up': '#1D4ED8', 'Disputed': 'var(--red)', 'Cancelled': 'var(--gray)', 'Refunded': 'var(--purple)', 'Resolved': 'var(--teal)' };
  var statusBgs = { 'Reserved': '#E8F5EE', 'Picked Up': '#E8F4FD', 'Disputed': '#FEF0EC', 'Cancelled': '#F3F4F6', 'Refunded': '#EDE9FE', 'Resolved': '#CCFBF1' };
  var pickupIcons = {
    'Collected': '<i class="bi bi-check-circle-fill" style="color:var(--green)"></i>',
    'Awaiting Pickup': '<i class="bi bi-hourglass-split" style="color:#B45309"></i>',
    'Cancelled': '<i class="bi bi-x-circle-fill" style="color:var(--gray)"></i>',
    'Issue Raised': '<i class="bi bi-exclamation-triangle-fill" style="color:#F59E0B"></i>',
    'Refund Issued': '<i class="bi bi-cash-stack" style="color:#1D4ED8"></i>',
    'Resolved': '<i class="bi bi-check2-circle" style="color:var(--green)"></i>'
  };
  grid.innerHTML = filtered.map(function (r) {
    var st = r.status || 'Reserved';
    var ps = r.pickup_status || '—';
    var sc = statusColors[st] || 'var(--gray)';
    var sb = statusBgs[st] || '#F3F4F6';
    var pi = pickupIcons[ps] || '<i class="bi bi-box-seam"></i>';
    var acts = '';
    if (st === 'Reserved') {
      acts += '<button class="btn btn-xs btn-green" onclick="markPickedUp(\'' + r.id + '\')" title="Picked Up"><i class="bi bi-check-circle-fill"></i> Picked Up</button>';
      acts += '<button class="btn btn-xs btn-red"   onclick="cancelReservation(\'' + r.id + '\')" title="Cancel"><i class="bi bi-x-lg"></i> Cancel</button>';
      acts += '<button class="btn btn-xs btn-amber" onclick="markDisputed(\'' + r.id + '\')" title="Flag"><i class="bi bi-exclamation-triangle-fill"></i> Dispute</button>';
    } else if (st === 'Disputed') {
      acts += '<button class="btn btn-xs btn-admin" onclick="showDisputeModal(\'' + r.id + '\')">Resolve Dispute</button>';
    } else if (st === 'Picked Up') {
      acts += '<button class="btn btn-xs btn-admin" onclick="showOrderDetails(\'' + r.id + '\')"><i class="bi bi-card-text"></i> View Details</button>';
      acts += '<button class="btn btn-xs btn-amber" onclick="markDisputed(\'' + r.id + '\')">Flag Dispute</button>';
    }
    return '<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:18px 22px;display:flex;align-items:flex-start;gap:18px;flex-wrap:wrap">'
      + '<div style="min-width:88px"><div style="font-size:10px;font-weight:700;color:var(--gray);text-transform:uppercase;letter-spacing:.5px">Order</div><div style="font-size:13px;font-weight:800;color:var(--admin)">' + escHtml(r.id) + '</div></div>'
      + '<div style="flex:1;min-width:150px"><div style="font-size:14px;font-weight:700;margin-bottom:2px">' + escHtml(r.item) + '</div><div style="font-size:12px;color:var(--gray)"><i class="bi bi-shop"></i> ' + escHtml(r.business) + '</div></div>'
      + '<div style="min-width:120px"><div style="font-size:10px;font-weight:700;color:var(--gray);text-transform:uppercase;letter-spacing:.5px">Buyer</div><div style="font-size:13px;font-weight:600">' + escHtml(r.buyer_name) + '</div><div style="font-size:11px;color:var(--gray)">' + escHtml(r.buyer_email || '') + '</div></div>'
      + '<div style="min-width:70px;text-align:center"><div style="font-size:18px;font-weight:800;color:var(--green)">' + escHtml(r.price) + '</div></div>'
      + '<div style="min-width:130px"><div style="font-size:10px;font-weight:700;color:var(--gray);text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px">Pickup Status</div><div style="font-size:13px;font-weight:600">' + pi + ' ' + escHtml(ps) + '</div><div style="font-size:11px;color:var(--gray);margin-top:2px">' + fmtDate(r.created_at) + '</div></div>'
      + '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:7px;min-width:110px"><span style="display:inline-block;background:' + sb + ';color:' + sc + ';font-size:11px;font-weight:700;padding:4px 12px;border-radius:50px">' + escHtml(st) + '</span><div class="action-btns" style="justify-content:flex-end">' + acts + '</div></div>'
      + '</div>';
  }).join('');
}

/* ══ RECENT ORDERS (dashboard) ════════════════════════════════ */
function renderRecentOrders(orders) {
  var tb = document.getElementById('recent-orders-tbody'); if (!tb) return;
  var res = (orders || []).slice(0, 8);
  if (!res.length) { tb.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--gray);padding:20px">No orders yet.</td></tr>'; return; }
  var sColors = { 'Reserved': 'var(--green)', 'Picked Up': '#1D4ED8', 'Disputed': 'var(--red)', 'Cancelled': 'var(--gray)', 'Refunded': 'var(--purple)' };
  var sBgs = { 'Reserved': '#E8F5EE', 'Picked Up': '#E8F4FD', 'Disputed': '#FEF0EC', 'Cancelled': '#F3F4F6', 'Refunded': '#EDE9FE' };
  var pIcon = {
    'Awaiting Pickup': '<i class="bi bi-hourglass-split"></i>',
    'Collected': '<i class="bi bi-check-circle-fill" style="color:var(--green)"></i>',
    'Cancelled': '<i class="bi bi-x-circle-fill"></i>',
    'Issue Raised': '<i class="bi bi-exclamation-triangle-fill"></i>',
    'Refund Issued': '<i class="bi bi-cash-stack"></i>'
  };
  tb.innerHTML = res.map(function (r) {
    var st = r.status || 'Reserved';
    var ps = r.pickup_status || 'Awaiting Pickup';
    var pi = pIcon[ps] || '<i class="bi bi-box-seam"></i>';
    var isNew = (Date.now() - new Date(r.created_at).getTime()) < 300000;
    var acts = '';
    if (st === 'Reserved') acts = '<button class="btn btn-xs btn-green" onclick="markPickedUp(\'' + r.id + '\')" title="Picked Up"><i class="bi bi-check-circle-fill"></i></button><button class="btn btn-xs btn-red" onclick="cancelReservation(\'' + r.id + '\')" title="Cancel"><i class="bi bi-x-lg"></i></button>';
    if (st === 'Disputed') acts = '<button class="btn btn-xs btn-admin" onclick="showDisputeModal(\'' + r.id + '\')" title="Resolve"><i class="bi bi-scale"></i> Resolve</button>';
    return '<tr style="' + (isNew ? 'background:rgba(0,232,122,0.1);' : '') + '">'
      + '<td style="font-size:12px;font-weight:800;color:var(--admin)">' + escHtml(r.id) + (isNew ? '<span style="margin-left:5px;background:var(--green);color:#fff;font-size:9px;font-weight:700;padding:1px 6px;border-radius:50px">NEW</span>' : '') + '</td>'
      + '<td><strong>' + escHtml(r.buyer_name) + '</strong><div style="font-size:11px;color:var(--gray)">' + escHtml(r.buyer_email || '') + '</div></td>'
      + '<td style="font-size:13px">' + escHtml(r.item) + '</td>'
      + '<td style="font-size:12px;color:var(--gray)">' + escHtml(r.business) + '</td>'
      + '<td><strong style="color:var(--green)">' + escHtml(r.price) + '</strong></td>'
      + '<td>' + pi + ' <span style="font-size:12px">' + escHtml(ps) + '</span></td>'
      + '<td style="font-size:11px;color:var(--gray)">' + fmtDate(r.created_at) + '</td>'
      + '<td><span style="display:inline-block;background:' + (sBgs[st] || '#F3F4F6') + ';color:' + (sColors[st] || 'var(--gray)') + ';font-size:10px;font-weight:700;padding:3px 10px;border-radius:50px">' + escHtml(st) + '</span></td>'
      + '<td><div class="action-btns">' + acts + '</div></td>'
      + '</tr>';
  }).join('');
}

/* ══ ORDER BADGE ══════════════════════════════════════════════ */
function checkNewOrders(count) {
  var c = count || 0;
  if (c > _lastOrderCount && _lastOrderCount > 0) {
    var badge = document.getElementById('order-badge');
    if (badge) badge.style.display = 'inline-block';
  }
  _lastOrderCount = c;
}
function clearOrderBadge() {
  var badge = document.getElementById('order-badge');
  if (badge) badge.style.display = 'none';
}

/* ══ VERIFY SELLER MODAL ══════════════════════════════════════ */
async function showVerifyModal(uid) {
  currentVerifySellerId = uid;
  try {
    var users = await apiGetUsers({ search: uid });
    var u = users.find(function (x) { return x.id === uid; });
    if (!u) return;
    document.getElementById('verify-seller-info').innerHTML =
      '<table style="width:100%;border-collapse:collapse">' +
      ['Business Name:' + escHtml(u.name), 'Email:' + escHtml(u.email), 'Business Type:' + escHtml(u.biz_type || '—'), 'Address:' + escHtml(u.location || '—'), 'Permit No.:' + escHtml(u.permit || 'Not provided'), 'Current Status:<span class="badge badge-' + (u.status || 'pending').toLowerCase() + '">' + escHtml(u.status || 'Pending') + '</span>']
        .map(function (r) {
          var p = r.indexOf(':'); var k = r.slice(0, p), v = r.slice(p + 1);
          return '<tr><td style="padding:7px 0;font-size:12px;font-weight:700;color:var(--gray);width:120px">' + k + '</td><td style="padding:7px 0;font-size:14px;font-weight:500">' + v + '</td></tr>';
        }).join('') + '</table>';
    document.getElementById('modal-verify-seller').classList.add('show');
  } catch (e) { showToast('Could not load seller info.', '#E76F51'); }
}
function closeVerifyModal() { document.getElementById('modal-verify-seller').classList.remove('show'); currentVerifySellerId = null; }
async function actOnSeller(newStatus) {
  if (!currentVerifySellerId) return;
  try {
    await apiVerifySeller(currentVerifySellerId, newStatus);
    closeVerifyModal();
    showToast(newStatus === 'Verified' ? 'Seller verified!' : 'Seller rejected.', newStatus === 'Verified' ? '#2D6A4F' : '#E76F51');
    refreshAdminData();
  } catch (e) { showToast('Error: ' + e.message, '#E76F51'); }
}

/* ══ RESOLVE REPORT MODAL ════════════════════════════════════ */
async function showReportModal(rid) {
  currentReportId = rid;
  try {
    var reports = await apiGetReports();
    var r = reports.find(function (x) { return x.id === rid; });
    if (r) document.getElementById('resolve-report-msg').textContent = r.issue_type + ' report against ' + r.against + ' by ' + r.reporter + ': "' + (r.details || '').slice(0, 80) + '…"';
    document.getElementById('modal-resolve-report').classList.add('show');
  } catch (e) { }
}
function closeReportModal() { document.getElementById('modal-resolve-report').classList.remove('show'); currentReportId = null; }
async function resolveReport() {
  if (!currentReportId) return;
  var action = document.getElementById('resolve-action').value;
  try {
    await apiResolveReport(currentReportId, action);
    closeReportModal();
    showToast('Report resolved — action: ' + action.replace(/_/g, ' ') + '.');
    refreshAdminData();
  } catch (e) { showToast('Error: ' + e.message, '#E76F51'); }
}

/* ══ DISPUTE MODAL ════════════════════════════════════════════ */
async function showDisputeModal(rid) {
  currentDisputeId = rid;
  try {
    var orders = await apiGetAllReservations();
    var r = orders.find(function (x) { return x.id === rid; });
    if (r) document.getElementById('dispute-msg').textContent = 'Dispute for order ' + r.id + ': "' + r.item + '" by ' + r.buyer_name;
    document.getElementById('modal-dispute').classList.add('show');
  } catch (e) { }
}
function closeDisputeModal() { document.getElementById('modal-dispute').classList.remove('show'); currentDisputeId = null; }
async function resolveDispute() {
  if (!currentDisputeId) return;
  var action = document.getElementById('dispute-action').value;
  try {
    await apiResolveDispute(currentDisputeId, action);
    closeDisputeModal();
    showToast('✅ Dispute resolved.');
    refreshAdminData();
  } catch (e) { showToast('Error: ' + e.message, '#E76F51'); }
}

/* ══ EDIT USER PANEL ══════════════════════════════════════════ */
async function openEditUser(uid) {
  editingUid = uid;
  try {
    var users = await apiGetUsers();
    var u = users.find(function (x) { return x.id === uid; });
    if (!u) return;
    document.getElementById('edit-uid').value = uid;
    document.getElementById('edit-name').value = u.name;
    document.getElementById('edit-email').value = u.email;
    document.getElementById('edit-role').value = u.role;
    document.getElementById('edit-pass').value = '';
    document.getElementById('edit-user-panel').style.display = 'flex';
  } catch (e) { showToast('Could not load user.', '#E76F51'); }
}
function closeEditUser() { document.getElementById('edit-user-panel').style.display = 'none'; editingUid = null; }
async function saveEditUser() {
  var uid = document.getElementById('edit-uid').value;
  var updates = { name: document.getElementById('edit-name').value.trim(), email: document.getElementById('edit-email').value.trim(), role: document.getElementById('edit-role').value };
  var newPass = document.getElementById('edit-pass').value;
  if (newPass.length >= 6) updates.password = newPass;
  try {
    await apiUpdateUser(uid, updates);
    closeEditUser();
    showToast('User updated successfully!');
    refreshAdminData();
  } catch (e) { showToast('Error: ' + e.message, '#E76F51'); }
}

/* ══ EDIT LISTING PANEL ═══════════════════════════════════════ */
async function openEditListing(lid) {
  editingLid = lid;
  try {
    var listings = await apiGetAllListings();
    var l = listings.find(function (x) { return x.id === lid; });
    if (!l) return;
    document.getElementById('edit-lid').value = lid;
    document.getElementById('edit-item').value = l.item;
    document.getElementById('edit-biz').value = l.business;
    document.getElementById('edit-orig').value = l.orig_price;
    document.getElementById('edit-disc').value = l.disc_price;
    document.getElementById('edit-listing-panel').style.display = 'flex';
  } catch (e) { showToast('Could not load listing.', '#E76F51'); }
}
function closeEditListing() { document.getElementById('edit-listing-panel').style.display = 'none'; editingLid = null; }
async function saveEditListing() {
  var lid = document.getElementById('edit-lid').value;
  var updates = { item: document.getElementById('edit-item').value.trim(), business: document.getElementById('edit-biz').value.trim(), orig_price: parseFloat(document.getElementById('edit-orig').value), disc_price: parseFloat(document.getElementById('edit-disc').value) };
  try {
    await apiUpdateListing(lid, updates);
    closeEditListing();
    showToast('Listing updated!');
    refreshAdminData();
  } catch (e) { showToast('Error: ' + e.message, '#E76F51'); }
}

/* ══ REPORT RESOLVE MODAL ════════════════════════════════════ */
var _currentReportId = null;

function showReportModal(rid) {
  _currentReportId = rid;
  var sel = document.getElementById('resolve-action');
  if (sel) sel.value = 'warn';
  onResolveActionChange();
  var overlay = document.getElementById('modal-resolve-report');
  if (overlay) overlay.style.display = 'flex';
}

function closeReportModal() {
  _currentReportId = null;
  var overlay = document.getElementById('modal-resolve-report');
  if (overlay) overlay.style.display = 'none';
}

function onResolveActionChange() {
  var sel = document.getElementById('resolve-action');
  var box = document.getElementById('suspend-duration-box');
  if (!sel || !box) return;
  box.style.display = sel.value === 'suspend' ? 'block' : 'none';
  if (sel.value === 'suspend') {
    // Default to 7 days
    setSuspendDays(7);
  }
}

function setSuspendDays(days) {
  var inp = document.getElementById('suspend-until');
  var prev = document.getElementById('suspend-preview');
  if (!inp) return;
  if (days === 0) {
    inp.value = '';
    if (prev) prev.textContent = '\u26a0\ufe0f Permanent suspension — no automatic reinstatement.';
    return;
  }
  var d = new Date();
  d.setDate(d.getDate() + days);
  // Format as datetime-local (YYYY-MM-DDTHH:mm)
  var pad = function (n) { return String(n).padStart(2, '0'); };
  inp.value = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  if (prev) prev.textContent = '\ud83d\udcc5 Suspended until: ' + d.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
}

async function resolveReport() {
  if (!_currentReportId) return;
  var action = (document.getElementById('resolve-action') || { value: 'dismiss' }).value;
  var suspendedUntil = null;
  if (action === 'suspend') {
    var inp = document.getElementById('suspend-until');
    suspendedUntil = inp && inp.value ? new Date(inp.value).toISOString() : null;
  }
  try {
    await apiResolveReport(_currentReportId, action, suspendedUntil);
    showToast(action === 'suspend' ? 'Seller suspended.' : 'Report resolved.', action === 'suspend' ? '#E76F51' : undefined);
    closeReportModal();
    refreshAdminData();
  } catch (e) { showToast('Error: ' + e.message, '#E76F51'); }
}

/* ══ SUSPEND USER MODAL ══════════════════════════════════════ */
var _suspendTargetUid = null;

function suspendUser(uid, uname) {
  _suspendTargetUid = uid;
  var msgEl = document.getElementById('suspend-user-msg');
  if (msgEl) msgEl.textContent = 'You are about to suspend "' + (uname || 'this user') + '". Choose how long:';
  setUserSuspendDays(7); // default 7 days
  var modal = document.getElementById('modal-suspend-user');
  if (modal) modal.style.display = 'flex';
}

function closeUserSuspendModal() {
  _suspendTargetUid = null;
  var modal = document.getElementById('modal-suspend-user');
  if (modal) modal.style.display = 'none';
}

function setUserSuspendDays(days) {
  var inp  = document.getElementById('user-suspend-until');
  var prev = document.getElementById('user-suspend-preview');
  if (!inp) return;
  if (days === 0) {
    inp.value = '';
    if (prev) prev.textContent = '\u26a0\ufe0f Permanent suspension \u2014 no automatic reinstatement.';
    return;
  }
  var d = new Date();
  d.setDate(d.getDate() + days);
  var pad = function (n) { return String(n).padStart(2, '0'); };
  inp.value = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  if (prev) prev.textContent = '\ud83d\udcc5 Suspended until: ' + d.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
}

async function confirmSuspendUser() {
  if (!_suspendTargetUid) return;
  var inp = document.getElementById('user-suspend-until');
  var suspendedUntil = inp && inp.value ? new Date(inp.value).toISOString() : null;
  try {
    await apiSuspendUser(_suspendTargetUid, suspendedUntil);
    showToast('User suspended.', '#E76F51');
    closeUserSuspendModal();
    refreshAdminData();
  } catch (e) { showToast('Error: ' + e.message, '#E76F51'); }
}

async function unsuspendUser(uid) { try { await apiRestoreUser(uid); showToast('User account restored.'); refreshAdminData(); } catch (e) { showToast('Error: ' + e.message, '#E76F51'); } }

async function deleteUser(uid) { if (!confirm('Permanently delete this user? This cannot be undone.')) return; try { await apiDeleteUser(uid); showToast('User deleted.', '#E76F51'); refreshAdminData(); } catch (e) { showToast('Error: ' + e.message, '#E76F51'); } }

async function approveListing(lid) { try { await apiApproveListing(lid); showToast('Listing approved!'); refreshAdminData(); } catch (e) { showToast('Error: ' + e.message, '#E76F51'); } }
async function rejectListing(lid) { try { await apiRejectListing(lid); showToast('Listing rejected.', '#E76F51'); refreshAdminData(); } catch (e) { showToast('Error: ' + e.message, '#E76F51'); } }
async function featureListing(lid, featured) { try { await apiFeatureListing(lid, featured); showToast(featured ? 'Featured!' : 'Unfeatured.', featured ? '#E9C46A' : undefined); refreshAdminData(); } catch (e) { showToast('Error: ' + e.message, '#E76F51'); } }
async function adminDelListing(lid) { if (!confirm('Remove this listing?')) return; try { await apiDeleteListing(lid); showToast('Listing removed.', '#E76F51'); refreshAdminData(); } catch (e) { showToast('Error: ' + e.message, '#E76F51'); } }

async function markPickedUp(rid) { try { await apiMarkPickedUp(rid); showToast('Marked as picked up!'); refreshAdminData(); showOrderDetails(rid); } catch (e) { showToast('Error: ' + e.message, '#E76F51'); } }
async function cancelReservation(rid) { if (!confirm('Cancel this reservation?')) return; try { await apiCancelOrder(rid); showToast('Order cancelled.', '#E76F51'); refreshAdminData(); } catch (e) { showToast('Error: ' + e.message, '#E76F51'); } }
async function markDisputed(rid) { try { await apiMarkDisputed(rid); showToast('Flagged as disputed.', '#E9C46A'); refreshAdminData(); } catch (e) { showToast('Error: ' + e.message, '#E76F51'); } }
async function issueWarning(rid) { try { await apiWarnReport(rid); showToast('Warning issued.', '#E9C46A'); refreshAdminData(); } catch (e) { showToast('Error: ' + e.message, '#E76F51'); } }
async function removeBadSeller(rid) { showReportModal(rid); }

/* ══ ADMIN PROFILE ═══════════════════════════════════════════ */
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

function renderAdminProfile() {
  if (!currentUser) return;
  var nameEl   = document.getElementById('admin-profile-name');
  var emailEl  = document.getElementById('admin-profile-email');
  var joinEl   = document.getElementById('admin-profile-joined');
  var loginEl  = document.getElementById('admin-profile-login');
  var actEl    = document.getElementById('admin-profile-actions');
  var idEl     = document.getElementById('admin-profile-id');
  if (nameEl)  nameEl.textContent  = currentUser.name;
  if (emailEl) emailEl.textContent = currentUser.email;
  if (joinEl)  joinEl.textContent  = fmtDate(currentUser.joined_at);
  if (loginEl) loginEl.textContent = fmtDate(currentUser.last_login);
  if (actEl)   actEl.textContent   = document.getElementById('stat-actions') ? document.getElementById('stat-actions').textContent : '\u2014';
  if (idEl)    idEl.textContent    = currentUser.id ? currentUser.id.slice(0, 16) + '\u2026' : '\u2014';
  var savedPhoto = localStorage.getItem('fs_avatar_' + currentUser.id);
  if (savedPhoto) _applyAvatar(savedPhoto);
}

/* ══ ORDER DETAILS MODAL ══════════════════════════════════════ */
async function showOrderDetails(rid) {
  var idEl = document.getElementById('details-order-id');
  if (idEl) idEl.textContent = rid;
  var wrap = document.getElementById('details-order-history');
  if (wrap) wrap.innerHTML = '<div style="color:var(--gray);text-align:center;padding:10px">Loading history...</div>';

  var modal = document.getElementById('modal-order-details');
  if (modal) modal.style.display = 'flex';

  // Fetch reservation to show the correct payment method
  try {
    var logs = await apiGetLog();
    var orderLogs = logs.filter(function(l) { return l.msg.includes(rid); });
    var pmEl = document.getElementById('details-payment-method');
    if (pmEl) {
      // The creation log always contains "via <method>" — extract it
      var creationLog = orderLogs.find(function(l) { return l.msg.toLowerCase().includes('reserved by'); });
      var method = 'Cash on Pickup / Pay at Store';
      if (creationLog) {
        var viaIdx = creationLog.msg.lastIndexOf(' via ');
        if (viaIdx !== -1) method = creationLog.msg.slice(viaIdx + 5).trim();
      }
      var isEwallet = /gcash|maya|e-wallet/i.test(method);
      var icon = isEwallet ? '<i class="bi bi-phone-fill"></i>' : '<i class="bi bi-cash"></i>';
      pmEl.innerHTML = icon + ' ' + escHtml(method);
    }
    if (!wrap) return;
    if (orderLogs.length === 0) {
      wrap.innerHTML = '<div style="color:var(--gray);padding:10px"><i class="bi bi-info-circle"></i> No specific history logs found for this order.</div>';
    } else {
      wrap.innerHTML = orderLogs.map(function(l) {
        var colors = { 'green': '#10B981', 'amber': '#F59E0B', 'red': '#EF4444', 'blue': '#3B82F6' };
        var c = colors[l.type] || 'var(--gray)';
        return '<div style="display:flex;gap:12px;padding:8px 0;border-bottom:1px solid var(--border)">'
             + '<div style="width:8px;height:8px;border-radius:50%;background:' + c + ';margin-top:6px;flex-shrink:0"></div>'
             + '<div><div style="font-weight:600;color:var(--text-main);margin-bottom:2px">' + escHtml(l.msg) + '</div>'
             + '<div style="font-size:11px;color:var(--text-muted)">' + new Date(l.created_at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) + '</div>'
             + '</div></div>';
      }).join('');
    }
  } catch (e) {
    if (wrap) wrap.innerHTML = '<div style="color:var(--red);padding:10px">Unable to load history.</div>';
  }
}

function closeOrderDetails() {
  var modal = document.getElementById('modal-order-details');
  if (modal) modal.style.display = 'none';
}

/* ══ INIT ═════════════════════════════════════════════════════ */
(async function () {
  await loadSession();
  if (!currentUser) { goAuth('login'); return; }
  if (currentUser.role !== 'admin') { goHome(); return; }

  document.getElementById('admin-greeting').textContent = 'Hi, ' + currentUser.name;
  renderAdminProfile();
  refreshAdminData();

  // Poll every 10 s
  setInterval(function () { refreshAdminData(); }, 10000);

  document.querySelectorAll('input,select,textarea').forEach(function (el) {
    el.addEventListener('input', function () { this.classList.remove('input-error'); });
    el.addEventListener('change', function () { this.classList.remove('input-error'); });
  });
})();
