// frontend/js/api.js
// Direct Supabase client — no backend server needed.
// Keeps IDENTICAL function signatures to the previous Node.js version
// so app.js requires zero changes.
//
// Dependencies (loaded via CDN before this file):
//   • @supabase/supabase-js  →  window.supabase
//   • bcryptjs               →  window.dcodeIO.bcrypt  OR window.bcrypt
//   • config.js              →  SUPABASE_URL, SUPABASE_ANON_KEY

/* ── CLIENT SETUP ──────────────────────────────────────────── */
const { createClient } = window.supabase;
const _sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Resolve bcrypt from whichever UMD name the CDN exposes
const _bcrypt = window.dcodeIO && window.dcodeIO.bcrypt
  ? window.dcodeIO.bcrypt
  : window.bcrypt;

/* ── SESSION STORAGE ───────────────────────────────────────── */
function _getUser()      { try { return JSON.parse(localStorage.getItem('fs_user')); } catch(e) { return null; } }
function _saveUser(u)    { localStorage.setItem('fs_user', JSON.stringify(u)); }
function _clearUser()    { localStorage.removeItem('fs_user'); }

// Thin shims so any code that checks fs_token still works
function getToken()       { return localStorage.getItem('fs_token'); }
function saveToken(tok)   { localStorage.setItem('fs_token', tok); }
function clearToken()     { localStorage.removeItem('fs_token'); }

/* ── AUTH ──────────────────────────────────────────────────── */
async function apiLogin(email, password) {
  // Sign in via Supabase Auth
  const { data: authData, error: authError } = await _sb.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password
  });
  if (authError || !authData.user) throw new Error('Incorrect email or password.');

  // Fetch profile from public.users
  const { data: user, error: profileError } = await _sb
    .from('users')
    .select('*')
    .eq('id', authData.user.id)
    .single();

  if (profileError || !user) throw new Error('User profile not found.');
  if (user.status === 'Suspended')
    throw new Error('This account has been suspended. Contact support.');

  await _sb.from('users').update({ last_login: new Date().toISOString() }).eq('id', user.id);
  await _sb.from('admin_log').insert({ msg: `User "${user.name}" logged in (${user.role})`, type: 'green' });

  const { password_hash, ...safeUser } = user;
  _saveUser(safeUser);
  saveToken(authData.session.access_token);
  return safeUser;
}

async function apiSignup(name, email, password, role) {
  // Register via Supabase Auth — this creates the auth.users record
  const { data: authData, error: authError } = await _sb.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: { data: { name: name.trim(), role } }
  });
  if (authError) throw new Error(authError.message || 'Could not create account.');
  if (!authData.user) throw new Error('Signup failed. Try again.');

  const authId = authData.user.id;

  // Insert matching profile row into public.users using the auth UUID
  const { data: newUser, error: profileError } = await _sb
    .from('users')
    .insert({
      id:     authId,
      name:   name.trim(),
      email:  email.trim().toLowerCase(),
      role,
      status: role === 'seller' ? 'Pending' : 'Active'
    })
    .select()
    .single();

  if (profileError) throw new Error('Account created but profile setup failed. Please contact support.');
  await _sb.from('admin_log').insert({ msg: `New ${role} "${name}" registered`, type: 'green' });

  const { password_hash, ...safeUser } = newUser;
  _saveUser(safeUser);
  saveToken(authData.session ? authData.session.access_token : authId);
  return safeUser;
}

async function apiGetMe() {
  const stored = _getUser();
  if (!stored) throw new Error('Not authenticated.');
  const { data: user, error } = await _sb
    .from('users')
    .select('id, name, email, role, status, biz_type, location, joined_at, last_login')
    .eq('id', stored.id)
    .single();
  if (error || !user) throw new Error('User not found.');
  _saveUser(user);
  return user;
}

async function apiLogout() {
  await _sb.auth.signOut();
  _clearUser();
  clearToken();
}

/* ── LISTINGS ──────────────────────────────────────────────── */
async function apiGetListings(type) {
  let q = _sb.from('listings').select('*').eq('status', 'Approved').order('created_at', { ascending: false });
  if (type && type !== 'all') q = q.eq('type', type);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data;
}

async function apiGetAllListings(filters) {
  filters = filters || {};
  let q = _sb.from('listings').select('*').order('created_at', { ascending: false });
  if (filters.status && filters.status !== 'all') q = q.eq('status', filters.status);
  if (filters.search) q = q.or(`item.ilike.%${filters.search}%,business.ilike.%${filters.search}%`);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data;
}

async function apiPostListing(listing) {
  var user = _getUser();
  var payload = Object.assign({}, listing, {
    posted_by:    user ? user.name  : '',
    posted_email: user ? user.email : '',
    status:       'Pending'
  });
  
  // HOTFIX: Remove quantity before insert if the remote DB schema hasn't been migrated yet.
  delete payload.quantity;

  const { data, error } = await _sb.from('listings').insert(payload).select().single();
  if (error) throw new Error(error.message);
  await _sb.from('admin_log').insert({ msg: `New listing "${listing.item}" submitted by ${user ? user.name : '?'} (pending approval)`, type: 'blue' });
  return data;
}

async function apiUpdateListing(id, updates) {
  var user = _getUser();
  
  // HOTFIX: Remove quantity before update
  var payload = Object.assign({}, updates);
  delete payload.quantity;

  const { data, error } = await _sb.from('listings').update(payload).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  await _sb.from('admin_log').insert({ msg: `Listing "${data.item}" edited by ${user ? user.name : 'admin'}`, type: 'blue' });
  return data;
}

async function apiApproveListing(id) {
  const { data, error } = await _sb.from('listings').update({ status: 'Approved' }).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  await _sb.from('admin_log').insert({ msg: `Listing "${data.item}" approved`, type: 'green' });
  return { listing: data };
}

async function apiRejectListing(id) {
  const { data, error } = await _sb.from('listings').update({ status: 'Rejected' }).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  await _sb.from('admin_log').insert({ msg: `Listing "${data.item}" rejected`, type: 'red' });
  return { listing: data };
}

async function apiFeatureListing(id, featured) {
  const { data, error } = await _sb.from('listings').update({ featured: featured }).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  await _sb.from('admin_log').insert({ msg: `Listing "${data.item}" ${featured ? 'featured' : 'unfeatured'}`, type: 'amber' });
  return { listing: data };
}

async function apiDeleteListing(id) {
  const { data: listing } = await _sb.from('listings').select('item').eq('id', id).single();
  const { error } = await _sb.from('listings').delete().eq('id', id);
  if (error) throw new Error(error.message);
  await _sb.from('admin_log').insert({ msg: `Listing "${(listing && listing.item) || id}" removed by admin`, type: 'red' });
  return { success: true };
}

async function apiGetMyListings() {
  var user = _getUser();
  if (!user) throw new Error('Not authenticated.');
  const { data, error } = await _sb
    .from('listings')
    .select('*')
    .eq('posted_email', user.email)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

/* ── RESERVATIONS ──────────────────────────────────────────── */
async function apiReserveItem(item, business, price, paymentMethod) {
  var user = _getUser();
  var orderId = 'ORD-' + Date.now();
  var methodStr = paymentMethod || 'Cash on Pickup / Pay at Store';
  const { data, error } = await _sb
    .from('reservations')
    .insert({
      id:             orderId,
      buyer_name:     user.name,
      buyer_email:    user.email,
      item:           item,
      business:       business,
      price:          price,
      status:         'Reserved',
      pickup_status:  'Awaiting Pickup'
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  await _sb.from('admin_log').insert({ msg: `New order ${orderId}: "${item}" reserved by ${user.name} via ${methodStr}`, type: 'blue' });
  return data;
}

async function apiGetMyReservations() {
  var user = _getUser();
  const { data, error } = await _sb
    .from('reservations')
    .select('*')
    .eq('buyer_email', user.email)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

async function apiGetAllReservations(filters) {
  filters = filters || {};
  let q = _sb.from('reservations').select('*').order('created_at', { ascending: false });
  if (filters.status && filters.status !== 'all') q = q.eq('status', filters.status);
  if (filters.search) q = q.or(`buyer_name.ilike.%${filters.search}%,item.ilike.%${filters.search}%,business.ilike.%${filters.search}%`);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data;
}

async function apiMarkPickedUp(id) {
  const { data, error } = await _sb.from('reservations').update({ status: 'Picked Up', pickup_status: 'Collected' }).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  await _sb.from('admin_log').insert({ msg: `Order ${id} marked as picked up`, type: 'green' });
  return { reservation: data };
}

async function apiCancelOrder(id) {
  const { data, error } = await _sb.from('reservations').update({ status: 'Cancelled', pickup_status: 'Cancelled' }).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  await _sb.from('admin_log').insert({ msg: `Order ${id} cancelled`, type: 'amber' });
  return { reservation: data };
}

async function apiMarkDisputed(id) {
  const { data, error } = await _sb.from('reservations').update({ status: 'Disputed', pickup_status: 'Issue Raised' }).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  await _sb.from('admin_log').insert({ msg: `Order ${id} flagged as disputed`, type: 'amber' });
  return { reservation: data };
}

async function apiResolveDispute(id, action) {
  var statusMap = { cancel: 'Cancelled', refund: 'Refunded', warn: 'Resolved', dismiss: 'Resolved' };
  var pickupMap = { cancel: 'Cancelled', refund: 'Refund Issued', warn: 'Resolved', dismiss: 'Resolved' };
  const { data, error } = await _sb
    .from('reservations')
    .update({ status: statusMap[action] || 'Resolved', pickup_status: pickupMap[action] || 'Resolved' })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  await _sb.from('admin_log').insert({ msg: `Dispute for order ${id} resolved: ${action}`, type: 'amber' });
  return { reservation: data };
}

/* ── USERS (admin) ─────────────────────────────────────────── */
async function apiGetUsers(filters) {
  filters = filters || {};
  let q = _sb
    .from('users')
    .select('id, name, email, role, status, biz_type, location, permit, joined_at, last_login')
    .order('joined_at', { ascending: false });
  if (filters.role)   q = q.eq('role', filters.role);
  if (filters.status) q = q.eq('status', filters.status);
  if (filters.search) q = q.or(`name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data;
}

async function apiUpdateUser(id, updates) {
  var payload = {};
  if (updates.name)  payload.name  = updates.name.trim();
  if (updates.email) payload.email = updates.email.trim().toLowerCase();
  if (updates.role)  payload.role  = updates.role;
  if (updates.password && updates.password.length >= 6)
    payload.password_hash = await _bcrypt.hash(updates.password, 12);

  const { data, error } = await _sb.from('users').update(payload).eq('id', id).select('id, name, email, role, status').single();
  if (error) throw new Error(error.message);
  await _sb.from('admin_log').insert({ msg: `User "${data.name}" info updated by admin`, type: 'blue' });
  return data;
}

async function apiSuspendUser(id, suspendedUntil) {
  var updatePayload = { status: 'Suspended' };
  if (suspendedUntil) updatePayload.suspended_until = suspendedUntil;
  const { data, error } = await _sb.from('users').update(updatePayload).eq('id', id).select('name').single();
  if (error) throw new Error(error.message);
  await _sb.from('admin_log').insert({ msg: `User "${data.name}" suspended${suspendedUntil ? ' until ' + new Date(suspendedUntil).toLocaleDateString() : ' permanently'}`, type: 'red' });
  // Notify the user
  try {
    var suspMsg = suspendedUntil
      ? '\uD83D\uDD34 Your account has been suspended until ' + new Date(suspendedUntil).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) + '. Contact admin@freshsave.com to appeal.'
      : '\uD83D\uDD34 Your account has been permanently suspended. Contact admin@freshsave.com to appeal.';
    await apiNotifyUser(id, suspMsg, 'system');
  } catch (_) {}
  return { success: true };
}

async function apiRestoreUser(id) {
  const { data, error } = await _sb.from('users').update({ status: 'Active' }).eq('id', id).select('name').single();
  if (error) throw new Error(error.message);
  await _sb.from('admin_log').insert({ msg: `User "${data.name}" restored to Active`, type: 'green' });
  return { success: true };
}

async function apiDeleteUser(id) {
  const { data: user } = await _sb.from('users').select('name').eq('id', id).single();
  const { error } = await _sb.from('users').delete().eq('id', id);
  if (error) throw new Error(error.message);
  await _sb.from('admin_log').insert({ msg: `User "${(user && user.name) || id}" permanently deleted`, type: 'red' });
  return { success: true };
}

async function apiVerifySeller(id, status) {
  const { data, error } = await _sb.from('users').update({ status: status }).eq('id', id).select('name').single();
  if (error) throw new Error(error.message);
  await _sb.from('admin_log').insert({
    msg:  `Seller "${data.name}" ${status === 'Verified' ? 'verified and approved' : 'rejected/suspended'}`,
    type: status === 'Verified' ? 'green' : 'red'
  });
  return { success: true, status: status };
}

/* ── REPORTS ───────────────────────────────────────────────── */
async function apiGetReports(filters) {
  filters = filters || {};
  let q = _sb.from('reports').select('*').order('created_at', { ascending: false });
  if (filters.status) q = q.eq('status', filters.status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data;
}

async function apiSubmitReport(report) {
  var user = _getUser();
  var reportId = 'RPT-' + Date.now();
  var payload = Object.assign({
    id:             reportId,
    reporter:       user ? user.name  : '',
    reporter_email: user ? user.email : '',
    status:         'Open'
  }, report);
  const { data, error } = await _sb.from('reports').insert(payload).select().single();
  if (error) throw new Error(error.message);
  // Auto-notify the reported seller if we can find their account
  try {
    var againstVal = (report.against || '').trim();
    const { data: targets } = await _sb.from('users').select('id')
      .or('email.ilike.%' + againstVal + '%,name.ilike.%' + againstVal + '%').limit(1);
    if (targets && targets.length) {
      await apiNotifyUser(targets[0].id,
        '\u26a0\ufe0f A complaint has been filed against your account: "' + (report.issue_type || 'General') + '". An admin will review it shortly.',
        'system');
    }
  } catch (_) { /* non-critical */ }
  return data;
}

async function apiResolveReport(id, action, suspendedUntil) {
  var labelMap = { warn: 'Warning Issued', remove: 'Listing Removed', suspend: 'Seller Suspended', refund: 'Refund Issued', dismiss: 'Resolved' };
  const { data, error } = await _sb.from('reports').update({ status: labelMap[action] || 'Resolved' }).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  await _sb.from('admin_log').insert({ msg: `Report ${id} resolved: ${action}`, type: 'green' });
  // If suspending, write suspended_until to the user's record
  if (action === 'suspend' && data && data.against) {
    try {
      var aVal = (data.against || '').trim();
      const { data: targets } = await _sb.from('users').select('id')
        .or('email.ilike.%' + aVal + '%,name.ilike.%' + aVal + '%').limit(1);
      if (targets && targets.length) {
        var updatePayload = { status: 'Suspended' };
        if (suspendedUntil) updatePayload.suspended_until = suspendedUntil;
        // Try with suspended_until first, fall back without if column missing
        var { error: upErr } = await _sb.from('users').update(updatePayload).eq('id', targets[0].id);
        if (upErr && suspendedUntil) {
          // Column may not exist — retry with just status
          await _sb.from('users').update({ status: 'Suspended' }).eq('id', targets[0].id);
        }
        // Notify the seller
        var suspMsg = suspendedUntil
          ? '\uD83D\uDD34 Your account has been suspended until ' + new Date(suspendedUntil).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) + '. Contact admin@freshsave.com to appeal.'
          : '\uD83D\uDD34 Your account has been permanently suspended. Contact admin@freshsave.com to appeal.';
        await apiNotifyUser(targets[0].id, suspMsg, 'system');
      }
    } catch (_) { /* non-critical */ }
  } else {
    // Notify for other resolutions
    try {
      var msgMap = {
        warn:    '\u26A0\uFE0F Admin has issued a formal warning on your account. Please review your listings and conduct.',
        remove:  '\uD83D\uDEAB A listing on your account has been removed by admin following a complaint.',
        refund:  '\u2705 A refund has been issued to a buyer following a complaint. Please ensure quality standards.',
        dismiss: '\u2705 A complaint filed against your account has been reviewed and dismissed. No action taken.'
      };
      var msg = msgMap[action] || '\u2139\uFE0F A report against your account has been resolved by admin.';
      if (data && data.against) {
        var aVal2 = (data.against || '').trim();
        const { data: targets } = await _sb.from('users').select('id')
          .or('email.ilike.%' + aVal2 + '%,name.ilike.%' + aVal2 + '%').limit(1);
        if (targets && targets.length) await apiNotifyUser(targets[0].id, msg, 'system');
      }
    } catch (_) { /* non-critical */ }
  }
  return { report: data };
}

async function apiWarnReport(id) {
  const { data, error } = await _sb.from('reports').update({ status: 'Warning Issued' }).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  await _sb.from('admin_log').insert({ msg: `Warning issued for report ${id}`, type: 'amber' });
  // Notify the reported user
  try {
    if (data && data.against) {
      var warnVal = (data.against || '').trim();
      const { data: targets } = await _sb.from('users').select('id')
        .or('email.ilike.%' + warnVal + '%,name.ilike.%' + warnVal + '%').limit(1);
      if (targets && targets.length) {
        await apiNotifyUser(targets[0].id,
          '\u26a0\ufe0f Admin has issued a formal warning against your account. Please ensure your listings and conduct follow our guidelines.',
          'system');
      }
    }
  } catch (_) { /* non-critical */ }
  return { report: data };
}

/* ── ADMIN ─────────────────────────────────────────────────── */
/* ── LANDING PAGE IMPACT STATS ─────────────────────────────── */
async function apiGetImpactStats() {
  try {
    const [mealsRes, usersRes, savingsRes] = await Promise.all([
      // Meals saved = any reservation that isn't Cancelled (food was rescued)
      _sb.from('reservations').select('*', { count: 'exact', head: true }).neq('status', 'Cancelled'),
      // Happy users = all active non-admin accounts (buyers + sellers)
      _sb.from('users').select('*', { count: 'exact', head: true }).neq('role', 'admin').eq('status', 'Active'),
      // Savings = sum of disc_price across all non-cancelled orders
      _sb.from('reservations').select('disc_price, orig_price').neq('status', 'Cancelled')
    ]);

    var meals  = mealsRes.count || 0;
    var users  = usersRes.count || 0;
    var orders = savingsRes.data || [];

    // CO² saved: ~0.55 kg per meal rescued from landfill (WRAP estimate)
    var co2Kg = Math.round(meals * 0.55);

    // Savings: prefer (orig_price - disc_price), fall back to disc_price total
    var savings = 0;
    var discountSavings = orders.reduce(function(sum, r) {
      var saved = (parseFloat(r.orig_price) || 0) - (parseFloat(r.disc_price) || 0);
      return sum + (saved > 0 ? saved : 0);
    }, 0);
    var discTotal = orders.reduce(function(sum, r) {
      return sum + (parseFloat(r.disc_price) || 0);
    }, 0);
    // Show actual discount savings if available, otherwise show total transaction value
    savings = discountSavings > 0 ? discountSavings : discTotal;

    return { meals: meals, users: users, co2Kg: co2Kg, savings: savings };
  } catch (e) {
    console.warn('apiGetImpactStats failed:', e);
    return null;
  }
}

async function apiGetStats() {
  var results = await Promise.all([
    _sb.from('users').select('*',        { count: 'exact', head: true }),
    _sb.from('listings').select('*',     { count: 'exact', head: true }),
    _sb.from('reservations').select('*', { count: 'exact', head: true }),
    _sb.from('reports').select('*',      { count: 'exact', head: true }).eq('status', 'Open'),
    _sb.from('users').select('*',        { count: 'exact', head: true }).eq('role', 'seller').eq('status', 'Pending'),
    _sb.from('users').select('*',        { count: 'exact', head: true }).eq('role', 'seller'),
    _sb.from('reservations').select('status')
  ]);
  var totalUsers     = results[0].count;
  var totalListings  = results[1].count;
  var totalOrders    = results[2].count;
  var openReports    = results[3].count;
  var pendingSellers = results[4].count;
  var totalSellers   = results[5].count;
  var orderData      = results[6].data || [];

  var ord_pending   = orderData.filter(function(r){ return r.status === 'Reserved';  }).length;
  var ord_pickedup  = orderData.filter(function(r){ return r.status === 'Picked Up'; }).length;
  var ord_cancelled = orderData.filter(function(r){ return r.status === 'Cancelled'; }).length;

  return { totalUsers: totalUsers, totalListings: totalListings, totalOrders: totalOrders, openReports: openReports, pendingSellers: pendingSellers, totalSellers: totalSellers, ord_pending: ord_pending, ord_pickedup: ord_pickedup, ord_cancelled: ord_cancelled };
}

async function apiGetNotifications() {
  const { data, error } = await _sb.from('notifications').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

async function apiNotifyUser(userId, msg, type) {
  // Uses the existing 'target' column — no DB migration needed
  const { data, error } = await _sb.from('notifications').insert({
    msg:    msg,
    target: 'personal:' + userId,
    type:   type || 'system'
  }).select().single();
  if (error) throw new Error(error.message);
  return data;
}

async function apiSendNotification(msg, target, type) {
  const { data, error } = await _sb.from('notifications').insert({ msg: msg, target: target, type: type || 'deal' }).select().single();
  if (error) throw new Error(error.message);
  await _sb.from('admin_log').insert({ msg: `Notification sent to ${target}: "${msg.slice(0,50)}"`, type: 'blue' });
  return data;
}

async function apiGetLog(filters) {
  filters = filters || {};
  let q = _sb.from('admin_log').select('*').order('created_at', { ascending: false }).limit(100);
  if (filters.type) q = q.eq('type', filters.type);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data;
}
