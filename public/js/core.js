'use strict';
/* =========================================================
   FreshFold Laundry — core (state, API, UI helpers, router)
   ========================================================= */
const S = { token: localStorage.getItem('ff_token'), user: null, config: null, notifs: [], current: null, lastUnread: 0, renderId: 0 };

const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cur = () => (S.config && S.config.settings.currency) || '৳';
const money = n => cur() + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
const fmtDate = d => d ? new Date(d.length === 10 ? d + 'T00:00:00' : d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
const fmtDT = d => d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-';
const initials = n => String(n || '?').split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase();
const todayISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const mapLink = a => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent([a.line, a.area, a.landmark].filter(Boolean).join(', '));
const addrText = a => a ? esc([a.line, a.area].filter(Boolean).join(', ')) + (a.landmark ? ' <span class="muted">(' + esc(a.landmark) + ')</span>' : '') : '-';
const stars = n => n ? '<span class="stars">' + '★'.repeat(n) + '<span style="color:#d6dde2">' + '★'.repeat(5 - n) + '</span></span>' : '<span class="muted">—</span>';
function timeAgo(d) {
  const s = (Date.now() - new Date(d)) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}
const badge = (cls, label) => `<span class="badge b-${esc(cls)}">${esc(label)}</span>`;
const statusBadge = s => badge(s, (S.config && S.config.statusLabels[s]) || s);
const PAY_LABEL = { paid: 'Paid', partial: 'Partially Prepaid', unpaid: 'Unpaid', refund_pending: 'Refund Pending', refunded: 'Refunded' };
const PAY_METHOD_LABEL = { online: 'Online Prepaid', prepayment: 'Prepayment + COD', cod: 'Cash on Delivery' };
const payMethodText = o => {
  const m = PAY_METHOD_LABEL[o.paymentMethod] || (o.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online');
  const p = o.paymentProvider && o.paymentProvider !== 'Cash on Delivery' && o.paymentProvider !== 'Online Gateway' ? ' · ' + o.paymentProvider : '';
  return m + p;
};
const payBadge = o => badge(o.paymentStatus, PAY_LABEL[o.paymentStatus] || o.paymentStatus) + ' <span class="muted small">' + esc(payMethodText(o)) + '</span>';
const emptyState = (icon, text, extra) => `<div class="empty"><div class="e-ic">${icon}</div><div>${text}</div>${extra || ''}</div>`;

/* ---------- API ---------- */
let useLocalBackend = location.protocol === 'file:';
async function api(method, url, body) {
  if (!useLocalBackend) {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (S.token) headers.Authorization = 'Bearer ' + S.token;
      const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
      const ct = res.headers.get('content-type') || '';
      if ((res.status === 404 || res.status === 405) && !ct.includes('application/json') && window.LocalBackend) {
        useLocalBackend = true;
      } else {
        let data = {};
        try { data = await res.json(); } catch (e) { /* empty */ }
        if (res.status === 401 && S.token && !url.startsWith('/api/auth/')) { logout(true); }
        if (!res.ok) throw new Error(data.error || 'Request failed (' + res.status + ')');
        return data;
      }
    } catch (err) {
      if (err instanceof TypeError && window.LocalBackend) {
        useLocalBackend = true;
      } else {
        throw err;
      }
    }
  }
  try {
    return window.LocalBackend.handle(method, url, body, S.token);
  } catch (err) {
    if (err.status === 401 && S.token && !url.startsWith('/api/auth/')) { logout(true); }
    throw new Error(err.message || 'Request failed');
  }
}

/* ---------- UI helpers ---------- */
function toast(msg, type) {
  const t = document.createElement('div');
  t.className = 'toast ' + (type || '');
  t.textContent = msg;
  $('#toasts').appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = '.3s'; }, 3200);
  setTimeout(() => t.remove(), 3600);
}

function modal(opts) {
  const root = $('#modal-root');
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal ${opts.wide ? 'wide' : ''}">
    <div class="modal-h"><h3>${opts.title || ''}</h3><button class="icon-btn" data-close>✕</button></div>
    <div class="modal-b">${opts.body || ''}</div>
    ${opts.foot ? `<div class="modal-f">${opts.foot}</div>` : ''}</div>`;
  root.appendChild(bg);
  const close = () => bg.remove();
  bg.addEventListener('click', e => { if (e.target === bg || e.target.hasAttribute('data-close')) close(); });
  const m = { el: bg, close };
  if (opts.onMount) opts.onMount(m);
  const first = bg.querySelector('input:not([type=hidden]),select,textarea');
  if (first) setTimeout(() => first.focus(), 50);
  return m;
}

function confirmBox(message, okLabel, danger) {
  return new Promise(resolve => {
    let done = false;
    const m = modal({
      title: 'Please confirm',
      body: `<p style="margin:0">${message}</p>`,
      foot: `<button class="btn ghost" data-close>Cancel</button><button class="btn ${danger ? 'danger' : ''}" id="cf-ok">${esc(okLabel || 'Confirm')}</button>`,
      onMount: mm => {
        $('#cf-ok', mm.el).onclick = () => { done = true; mm.close(); resolve(true); };
      }
    });
    const obs = new MutationObserver(() => { if (!document.body.contains(m.el)) { obs.disconnect(); if (!done) resolve(false); } });
    obs.observe($('#modal-root'), { childList: true });
  });
}

function formData(form) {
  const o = {};
  $$('[name]', form).forEach(i => {
    if (i.type === 'checkbox') o[i.name] = i.checked;
    else if (i.type === 'radio') { if (i.checked) o[i.name] = i.value; }
    else o[i.name] = i.value;
  });
  return o;
}

/** Wraps an async action on a button: disables it, shows errors as toast. */
async function busy(btn, fn) {
  const label = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.innerHTML = '⏳ Please wait…'; }
  try { return await fn(); }
  catch (e) { toast(e.message, 'error'); }
  finally { if (btn && document.body.contains(btn)) { btn.disabled = false; btn.innerHTML = label; } }
}

const areaOptions = sel => S.config.settings.serviceAreas.map(a => `<option ${a === sel ? 'selected' : ''}>${esc(a)}</option>`).join('');

/* ---------- Router ---------- */
const Pages = [];
function page(pattern, opts) {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  Pages.push(Object.assign({ pattern, re, keys }, opts));
}
const navigate = h => { if (location.hash.slice(1) === h) router(); else location.hash = h; };
const home = () => S.user ? ({ customer: '/c/dashboard', rider: '/r/dashboard', admin: '/a/dashboard' }[S.user.role]) : '/';

const NAV = {
  customer: [['/c/dashboard', '🏠', 'Dashboard'], ['/c/new', '🧺', 'Schedule Pickup'], ['/c/orders', '📦', 'My Orders'], ['/c/addresses', '📍', 'My Addresses'], ['/c/profile', '👤', 'Profile']],
  rider: [['/r/dashboard', '🛵', 'My Tasks'], ['/r/history', '📋', 'Task History'], ['/r/earnings', '💰', 'Earnings'], ['/r/profile', '👤', 'Profile']],
  admin: [['/a/dashboard', '📊', 'Dashboard'], ['/a/orders', '📦', 'Orders'], ['/a/customers', '👥', 'Customers'], ['/a/riders', '🛵', 'Riders'], ['/a/services', '🧺', 'Services & Pricing'], ['/a/coupons', '🎟️', 'Coupons'], ['/a/settings', '⚙️', 'Settings'], ['/a/profile', '👤', 'My Profile']]
};

function renderShell(pg, hash) {
  let shell = $('#shell');
  if (!shell || shell.dataset.role !== S.user.role) {
    const s = S.config.settings;
    $('#app').innerHTML = `<div class="shell" id="shell" data-role="${S.user.role}">
      <aside class="sidebar" id="sidebar">
        <div class="brand">🧺 <span>${esc(s.businessName.split(' ')[0])}</span> <span class="role-tag">${S.user.role}</span></div>
        <nav id="nav">${NAV[S.user.role].map(n => `<a href="#${n[0]}" data-path="${n[0]}"><span class="ni">${n[1]}</span>${n[2]}</a>`).join('')}</nav>
        <div class="side-foot"><div class="muted small">Need help?</div><div>📞 ${esc(s.supportPhone)}</div></div>
      </aside>
      <div class="overlay" id="overlay"></div>
      <div class="main">
        <header class="topbar">
          <button class="icon-btn menu-btn" id="menu-btn">☰</button>
          <h2 id="page-title"></h2>
          <button class="icon-btn" id="bell" title="Notifications">🔔<span class="dot hidden" id="bell-dot"></span></button>
          <div class="flex" style="gap:8px"><div class="avatar" id="tb-avatar"></div><div class="small hide-m" id="tb-name" style="font-weight:600"></div></div>
          <button class="btn ghost sm" id="logout-btn">Logout</button>
        </header>
        <div id="notif-holder"></div>
        <main class="content" id="page"></main>
      </div></div>`;
    $('#menu-btn').onclick = () => $('#sidebar').classList.toggle('open');
    $('#overlay').onclick = () => $('#sidebar').classList.remove('open');
    $('#logout-btn').onclick = () => logout();
    $('#bell').onclick = toggleNotifs;
    updateBell();
  }
  $('#tb-avatar').textContent = initials(S.user.name);
  $('#tb-name').textContent = S.user.name;
  $('#page-title').textContent = pg.title || '';
  const navPath = pg.nav || pg.pattern;
  $$('#nav a').forEach(a => a.classList.toggle('active', a.dataset.path === navPath));
  $('#sidebar').classList.remove('open');
  $('#notif-holder').innerHTML = '';
  document.title = (pg.title ? pg.title + ' · ' : '') + S.config.settings.businessName;
}

async function router() {
  const hash = location.hash.slice(1) || '/';
  let pg = null, params = {};
  for (const p of Pages) {
    const m = hash.match(p.re);
    if (m) { pg = p; p.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); }); break; }
  }
  if (!pg) return navigate(home());
  const rid = ++S.renderId;
  S.current = { pg, params, rid };
  window.scrollTo(0, 0);
  if (pg.roles) {
    if (!S.user) return navigate('/login');
    if (!pg.roles.includes(S.user.role)) return navigate(home());
    renderShell(pg, hash);
    const el = $('#page');
    el.innerHTML = '<div class="empty">Loading…</div>';
    try { await pg.render(el, params, rid); }
    catch (e) { if (rid === S.renderId) el.innerHTML = `<div class="card">${emptyState('⚠️', esc(e.message))}</div>`; }
  } else {
    if (pg.guestOnly && S.user) return navigate(home());
    document.title = S.config.settings.businessName;
    await pg.render($('#app'), params, rid);
  }
}

/** Re-render current page in place (after actions or by live polling). */
async function refreshPage() {
  if (!S.current || !S.current.pg.roles) return;
  const el = $('#page');
  if (!el) return;
  try { await S.current.pg.render(el, S.current.params, S.current.rid); } catch (e) { toast(e.message, 'error'); }
}

/* ---------- Notifications ---------- */
async function loadNotifs(silent) {
  if (!S.user) return;
  try {
    S.notifs = await api('GET', '/api/notifications');
    const unread = S.notifs.filter(n => !n.read);
    if (silent && unread.length > S.lastUnread && unread[0]) toast('🔔 ' + unread[0].title + ': ' + unread[0].message, 'info');
    S.lastUnread = unread.length;
    updateBell();
  } catch (e) { /* ignore */ }
}
function updateBell() {
  const dot = $('#bell-dot');
  if (!dot) return;
  const c = S.notifs.filter(n => !n.read).length;
  dot.textContent = c > 9 ? '9+' : c;
  dot.classList.toggle('hidden', !c);
}
function toggleNotifs() {
  const holder = $('#notif-holder');
  if (holder.innerHTML) { holder.innerHTML = ''; return; }
  const base = { customer: '/c/order/', rider: '/r/order/', admin: '/a/order/' }[S.user.role];
  holder.innerHTML = `<div class="notif-panel"><div class="nh"><span>Notifications</span><a href="javascript:void 0" id="nclose">Close</a></div>
    ${S.notifs.length ? S.notifs.map(n => `<div class="notif ${n.read ? '' : 'unread'}" data-oid="${n.orderId || ''}"><b>${esc(n.title)}</b><span>${esc(n.message)}</span><div class="small muted">${timeAgo(n.createdAt)}</div></div>`).join('') : emptyState('🔕', 'No notifications yet')}</div>`;
  $('#nclose').onclick = () => { holder.innerHTML = ''; };
  $$('.notif', holder).forEach(n => n.onclick = () => { holder.innerHTML = ''; if (n.dataset.oid) navigate(base + n.dataset.oid); });
  if (S.notifs.some(n => !n.read)) {
    api('POST', '/api/notifications/read').then(() => { S.notifs.forEach(n => { n.read = true; }); S.lastUnread = 0; updateBell(); }).catch(() => {});
  }
}

/* ---------- Auth ---------- */
function setSession(res) {
  S.token = res.token; S.user = res.user;
  localStorage.setItem('ff_token', res.token);
  S.lastUnread = 0;
  loadNotifs();
}
function logout(expired) {
  S.token = null; S.user = null; S.notifs = [];
  localStorage.removeItem('ff_token');
  if (expired) toast('Session expired, please log in again', 'error');
  navigate('/login');
}

/* ---------- Order tracker & shared order detail ---------- */
const TRACK = [['Placed', '📝'], ['Rider Assigned', '🛵'], ['Picked Up', '📦'], ['Cleaning', '🫧'], ['Ready', '✨'], ['On the Way', '🚚'], ['Delivered', '✅']];
const TRACK_IDX = { pending: 0, pickup_assigned: 1, picked_up: 2, at_laundry: 3, processing: 3, ready: 4, delivery_assigned: 4, out_for_delivery: 5, delivered: 6 };
const progressPct = s => s === 'cancelled' ? 0 : Math.round((TRACK_IDX[s] || 0) / 6 * 100);

function trackerHtml(status) {
  if (status === 'cancelled') return '<div class="notice" style="margin:0">❌ This order has been cancelled.</div>';
  const idx = TRACK_IDX[status] || 0;
  return `<div class="tracker"><div class="bar" style="width:${idx / 6 * 88}%"></div>
    ${TRACK.map((t, i) => `<div class="tstep ${i < idx || status === 'delivered' ? 'done' : i === idx ? 'cur' : ''}"><div class="tc">${i < idx || status === 'delivered' ? '✓' : t[1]}</div>${t[0]}</div>`).join('')}</div>`;
}

function itemsTable(o) {
  const paid = o.paidAmount !== undefined ? o.paidAmount : (o.paymentStatus === 'paid' ? o.total : 0);
  const due = o.dueAmount !== undefined ? o.dueAmount : Math.max(0, +(o.total - paid).toFixed(2));
  return `<div class="table-wrap"><table><thead><tr><th>Item</th><th>Service</th><th class="right">Rate</th><th class="right">Qty</th><th class="right">Amount</th></tr></thead><tbody>
    ${o.items.map(i => `<tr><td>${esc(i.icon || '')} ${esc(i.name)}</td><td class="muted">${esc(i.category)}</td><td class="right">${money(i.price)}/${esc(i.unit)}</td><td class="right">${i.qty}</td><td class="right">${money(i.total)}</td></tr>`).join('')}
    </tbody></table></div>
    <div style="max-width:340px;margin-left:auto;margin-top:10px">
      <div class="sum-row"><span>Subtotal</span><span>${money(o.subtotal)}</span></div>
      ${o.expressFee ? `<div class="sum-row"><span>⚡ Express</span><span>${money(o.expressFee)}</span></div>` : ''}
      <div class="sum-row"><span>Pickup & Delivery</span><span>${o.deliveryFee ? money(o.deliveryFee) : 'FREE'}</span></div>
      ${o.discount ? `<div class="sum-row" style="color:var(--ok)"><span>Discount ${o.couponCode ? '(' + esc(o.couponCode) + ')' : ''}</span><span>−${money(o.discount)}</span></div>` : ''}
      <div class="sum-row total"><span>Total Bill</span><span>${money(o.total)}</span></div>
      <div class="sum-row" style="color:var(--ok);font-weight:600"><span>Paid Amount</span><span>${money(paid)}</span></div>
      <div class="sum-row" style="color:${due > 0 ? 'var(--err)' : 'var(--ok)'};font-weight:700"><span>${due > 0 ? 'Due Amount (COD / Payable)' : 'Balance Due'}</span><span>${money(due)}</span></div>
    </div>`;
}

function paymentCardHtml(o, isCustomer) {
  const paid = o.paidAmount !== undefined ? o.paidAmount : (o.paymentStatus === 'paid' ? o.total : 0);
  const due = o.dueAmount !== undefined ? o.dueAmount : Math.max(0, +(o.total - paid).toFixed(2));
  const txs = Array.isArray(o.payments) ? o.payments : [];
  const canPay = isCustomer && due > 0 && !['cancelled', 'delivered'].includes(o.status);
  return `<div class="card"><div class="card-h"><h3>💳 Payment & Billing</h3></div>
    <div>${payBadge(o)}</div>
    <div class="pay-summary-box mt">
      <div class="sum-row"><span>Total Order Amount</span><b>${money(o.total)}</b></div>
      <div class="sum-row" style="color:var(--ok)"><span>Paid (Prepaid / Collected)</span><b>${money(paid)}</b></div>
      <div class="sum-row" style="color:${due > 0 ? 'var(--err)' : 'var(--ok)'};border-top:1px dashed var(--border);padding-top:8px;margin-top:4px">
        <span><b>${due > 0 ? 'Remaining Due (COD)' : 'Due Balance'}</b></span>
        <b style="font-size:17px">${money(due)}</b>
      </div>
    </div>
    ${o.transactionId ? `<div class="small muted mt">Latest Txn ID: <code style="font-weight:700;color:var(--text)">${esc(o.transactionId)}</code></div>` : ''}
    ${txs.length ? `<div class="mt"><div class="small" style="font-weight:700;margin-bottom:6px">Transaction History</div>
      ${txs.map(p => `<div class="tx-item"><div class="flex between"><b>${esc(p.provider || 'Online')}</b><b style="color:var(--ok)">+${money(p.amount)}</b></div>
        <div class="small muted">${esc(p.note || '')}${p.account ? ' · ' + esc(p.account) : ''}</div>
        <div class="small muted">Txn: <code>${esc(p.transactionId || '-')}</code> · ${fmtDT(p.at)}</div></div>`).join('')}</div>` : ''}
    ${canPay ? `<div class="mt no-print">
      <button class="btn success block" id="c-pay-full">💳 Pay Full Due Online (${money(due)})</button>
      ${paid === 0 && due >= 100 ? `<button class="btn outline block mt" id="c-pay-part" style="margin-top:8px">⚡ Make Advance Prepayment</button>` : ''}
    </div>` : ''}
  </div>`;
}

function riderCard(r, label) {
  if (!r) return `<div class="muted small">${label}: not assigned yet</div>`;
  return `<div class="flex" style="margin-bottom:10px"><div class="avatar">${initials(r.name)}</div><div class="grow"><div style="font-weight:600">${esc(r.name)}</div><div class="small muted">${label} · ${esc(r.vehicle || '')} ${esc(r.vehicleNumber || '')}</div></div><a class="btn sm outline" href="tel:${esc(r.phone)}">📞 Call</a></div>`;
}

async function renderOrderDetail(el, id, rid) {
  const o = await api('GET', '/api/orders/' + id);
  if (rid !== S.renderId) return;
  const role = S.user.role;
  const actions = role === 'customer' ? customerOrderActions(o) : role === 'rider' ? riderOrderActions(o) : adminOrderActions(o);
  const back = { customer: '/c/orders', rider: '/r/dashboard', admin: '/a/orders' }[role];
  el.innerHTML = `
    <div class="flex between wrap mb no-print"><a href="#${back}">← Back</a><button class="btn ghost sm" onclick="window.print()">🖨️ Print Invoice</button></div>
    <div class="card">
      <div class="card-h"><div><h3 style="font-size:22px">Order ${esc(o.code)} ${o.express ? '<span class="badge b-ready">⚡ Express</span>' : ''}</h3>
        <div class="muted small">Placed ${fmtDT(o.createdAt)} · ${esc(S.config.settings.businessName)}</div></div>
        <div>${statusBadge(o.status)}</div></div>
      ${trackerHtml(o.status)}
    </div>
    <div class="cols mt">
      <div>
        <div class="card"><div class="card-h"><h3>🧾 Items & Bill</h3></div>${itemsTable(o)}</div>
        <div class="card"><div class="card-h"><h3>🕒 Order Timeline</h3></div>
          <ul class="timeline">${o.timeline.slice().reverse().map(t => `<li><b>${esc(t.label)}</b>${t.note ? ' — ' + esc(t.note) : ''}<div class="small muted">${fmtDT(t.at)} · by ${esc(t.by)}</div></li>`).join('')}</ul></div>
        ${o.rating ? `<div class="card"><div class="card-h"><h3>⭐ Customer Feedback</h3></div><div>Service: ${stars(o.rating)} &nbsp; Rider: ${stars(o.riderRating)}</div>${o.review ? `<p class="muted">"${esc(o.review)}"</p>` : ''}</div>` : ''}
      </div>
      <div>
        ${actions ? `<div class="card no-print">${actions}</div>` : ''}
        ${o.customer ? `<div class="card"><div class="card-h"><h3>👤 Customer</h3></div><div style="font-weight:600">${esc(o.customer.name)}</div><div class="small muted">${esc(o.customer.email)}</div><a href="tel:${esc(o.customer.phone)}">📞 ${esc(o.customer.phone)}</a></div>` : ''}
        <div class="card"><div class="card-h"><h3>📍 Pickup</h3><a class="small no-print" target="_blank" href="${mapLink(o.pickupAddress)}">Map ↗</a></div>
          <dl class="kv"><dt>Date</dt><dd>${fmtDate(o.pickupDate)}</dd><dt>Time slot</dt><dd>${esc(o.pickupSlot)}</dd><dt>Address</dt><dd>${addrText(o.pickupAddress)}</dd><dt>Contact</dt><dd>${esc(o.pickupAddress.phone || '-')}</dd>${o.notes ? `<dt>Notes</dt><dd>${esc(o.notes)}</dd>` : ''}</dl></div>
        <div class="card"><div class="card-h"><h3>🏠 Delivery</h3><a class="small no-print" target="_blank" href="${mapLink(o.deliveryAddress)}">Map ↗</a></div>
          <dl class="kv"><dt>Address</dt><dd>${addrText(o.deliveryAddress)}</dd><dt>Contact</dt><dd>${esc(o.deliveryAddress.phone || '-')}</dd></dl></div>
        <div class="card"><div class="card-h"><h3>🛵 Riders</h3></div>${riderCard(o.pickupRider, 'Pickup')}${riderCard(o.deliveryRider, 'Delivery')}</div>
        ${paymentCardHtml(o, role === 'customer')}
      </div>
    </div>`;
  const hook = { customer: window.bindCustomerOrderActions, rider: window.bindRiderOrderActions, admin: window.bindAdminOrderActions }[role];
  if (hook) hook(el, o);
}

/* ---------- Profile page (shared) ---------- */
async function renderProfile(el) {
  const u = await api('GET', '/api/me');
  S.user = u;
  const rider = u.role === 'rider';
  el.innerHTML = `<div class="cols"><div>
    <div class="card"><div class="card-h"><h3>👤 Personal Information</h3></div>
      <form id="pf">
        <div class="grid2"><div class="field"><label>Full name</label><input name="name" value="${esc(u.name)}" required></div>
        <div class="field"><label>Phone</label><input name="phone" value="${esc(u.phone)}" required></div></div>
        <div class="field"><label>Email</label><input name="email" type="email" value="${esc(u.email)}" required></div>
        ${rider ? `<div class="grid2"><div class="field"><label>Vehicle type</label><select name="vehicle">${['Bicycle', 'Motorbike', 'Scooter', 'Car', 'Van'].map(v => `<option ${v === u.vehicle ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
          <div class="field"><label>Vehicle number</label><input name="vehicleNumber" value="${esc(u.vehicleNumber || '')}"></div></div>
          <div class="grid2"><div class="field"><label>Preferred area</label><select name="area">${areaOptions(u.area)}</select></div>
          <div class="field"><label>NID number</label><input name="nid" value="${esc(u.nid || '')}"></div></div>` : ''}
        <button class="btn">Save Changes</button>
      </form></div></div>
    <div><div class="card"><div class="card-h"><h3>🔒 Change Password</h3></div>
      <form id="pw"><div class="field"><label>Current password</label><input type="password" name="currentPassword" required></div>
      <div class="field"><label>New password</label><input type="password" name="newPassword" minlength="6" required></div>
      <div class="field"><label>Confirm new password</label><input type="password" name="confirm" minlength="6" required></div>
      <button class="btn outline">Update Password</button></form></div>
      <div class="card"><div class="flex"><div class="avatar" style="width:54px;height:54px;font-size:20px">${initials(u.name)}</div><div><b>${esc(u.name)}</b><div class="small muted">${esc(u.role)} · since ${fmtDate(u.createdAt)}</div>${rider ? `<div class="mt">${u.approved ? badge('active', 'Approved') : badge('pending', 'Pending approval')}</div>` : ''}</div></div></div>
    </div></div>`;
  $('#pf').onsubmit = e => { e.preventDefault(); busy(e.submitter, async () => { S.user = await api('PUT', '/api/me', formData(e.target)); toast('Profile updated'); renderShell(S.current.pg); }); };
  $('#pw').onsubmit = e => {
    e.preventDefault();
    const d = formData(e.target);
    if (d.newPassword !== d.confirm) return toast('Passwords do not match', 'error');
    busy(e.submitter, async () => { await api('PUT', '/api/me/password', d); e.target.reset(); toast('Password changed'); });
  };
}

/* ---------- Boot ---------- */
async function start() {
  try { S.config = await api('GET', '/api/public/config'); }
  catch (e) { $('#app').innerHTML = '<div class="boot">Cannot reach server. Is it running?</div>'; return; }
  if (S.token) {
    try { S.user = await api('GET', '/api/me'); loadNotifs(); }
    catch (e) { S.token = null; localStorage.removeItem('ff_token'); }
  }
  window.addEventListener('hashchange', router);
  document.addEventListener('click', e => {
    const h = $('#notif-holder');
    if (h && h.innerHTML && !e.target.closest('.notif-panel') && !e.target.closest('#bell')) h.innerHTML = '';
  });
  router();
  setInterval(async () => {
    if (!S.user) return;
    await loadNotifs(true);
    const busyNow = $('#modal-root').children.length || (document.activeElement && document.activeElement.closest && document.activeElement.closest('#page form, #page input, #page select, #page textarea'));
    if (S.current && S.current.pg.live && !busyNow) refreshPage();
  }, 15000);
}
window.addEventListener('load', start);

