'use strict';
/* ================= Admin pages ================= */
const A = ['admin'];
const ORDER_GROUPS = {
  All: null,
  New: ['pending'],
  Pickup: ['pickup_assigned', 'picked_up'],
  'In Laundry': ['at_laundry', 'processing'],
  Ready: ['ready'],
  Delivery: ['delivery_assigned', 'out_for_delivery'],
  Delivered: ['delivered'],
  Cancelled: ['cancelled']
};

function ordersTable(list) {
  if (!list.length) return emptyState('📭', 'No orders found.');
  return `<div class="table-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Area</th><th>Pickup</th><th>Amount</th><th>Payment</th><th>Status</th><th>Riders</th><th></th></tr></thead><tbody>
    ${list.map(o => `<tr><td><b>${esc(o.code)}</b>${o.express ? ' ⚡' : ''}<div class="small muted">${fmtDT(o.createdAt)}</div></td>
      <td>${esc(o.customer ? o.customer.name : '-')}<div class="small muted">${esc(o.customer ? o.customer.phone : '')}</div></td>
      <td>${esc(o.pickupAddress.area)}</td><td class="small">${fmtDate(o.pickupDate)}<div class="muted">${esc(o.pickupSlot)}</div></td>
      <td><b>${money(o.total)}</b>${o.paymentStatus === 'partial' ? `<div class="small" style="color:var(--ok)">Paid: ${money(o.paidAmount)}</div><div class="small" style="color:var(--err)">Due: ${money(o.dueAmount)}</div>` : ''}</td>
      <td>${badge(o.paymentStatus, PAY_LABEL[o.paymentStatus] || o.paymentStatus)}<div class="small muted">${esc(payMethodText(o))}</div></td>
      <td>${statusBadge(o.status)}</td>
      <td class="small">${o.pickupRider ? '📦 ' + esc(o.pickupRider.name) : '<span class="muted">📦 —</span>'}<br>${o.deliveryRider ? '🚚 ' + esc(o.deliveryRider.name) : '<span class="muted">🚚 —</span>'}</td>
      <td><a class="btn sm outline" href="#/a/order/${o.id}">Manage</a></td></tr>`).join('')}
    </tbody></table></div>`;
}

/* ---------- Dashboard ---------- */
page('/a/dashboard', {
  roles: A, title: 'Admin Dashboard', live: true,
  async render(el, p, rid) {
    const st = await api('GET', '/api/admin/stats');
    if (rid !== S.renderId) return;
    const maxRev = Math.max(1, ...st.days.map(d => d.revenue));
    const alerts = [];
    if (st.byStatus.pending) alerts.push(`<a href="#/a/orders" data-g="New">🆕 <b>${st.byStatus.pending}</b> new order(s) need a pickup rider</a>`);
    if (st.byStatus.ready) alerts.push(`<a href="#/a/orders" data-g="Ready">✨ <b>${st.byStatus.ready}</b> order(s) ready — assign delivery rider</a>`);
    if (st.byStatus.picked_up) alerts.push(`<a href="#/a/orders" data-g="Pickup">📦 <b>${st.byStatus.picked_up}</b> order(s) on the way to laundry</a>`);
    if (st.pendingRiders) alerts.push(`<a href="#/a/riders">🛵 <b>${st.pendingRiders}</b> rider application(s) awaiting approval</a>`);
    if (st.unsettledCash) alerts.push(`<a href="#/a/riders">💵 <b>${money(st.unsettledCash)}</b> cash held by riders (unsettled)</a>`);
    el.innerHTML = `
      <div class="stats">
        <div class="stat"><div class="ic">📦</div><div><div class="v">${st.totalOrders}</div><div class="l">Total orders (${st.todayOrders} today)</div></div></div>
        <div class="stat"><div class="ic">💰</div><div><div class="v">${money(st.revenue)}</div><div class="l">Revenue collected</div></div></div>
        <div class="stat"><div class="ic">⏳</div><div><div class="v">${money(st.pendingRevenue)}</div><div class="l">Pending collection</div></div></div>
        <div class="stat"><div class="ic">👥</div><div><div class="v">${st.customers}</div><div class="l">Customers</div></div></div>
        <div class="stat"><div class="ic">🛵</div><div><div class="v">${st.availableRiders}/${st.riders}</div><div class="l">Riders online</div></div></div>
      </div>
      <div class="cols"><div>
        <div class="card"><div class="card-h"><h3>📈 Last 7 days revenue</h3></div>
          <div class="chart">${st.days.map(d => `<div class="col"><div class="cv">${d.revenue ? money(d.revenue) : ''}</div><div class="barv" style="height:${d.revenue / maxRev * 130}px" title="${d.orders} orders"></div><div class="cl">${new Date(d.date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short' })}</div></div>`).join('')}</div></div>
        <div class="card"><div class="card-h"><h3>🕒 Recent orders</h3><a href="#/a/orders">View all →</a></div>${ordersTable(st.recent)}</div>
      </div><div>
        <div class="card"><div class="card-h"><h3>🔔 Needs attention</h3></div>${alerts.length ? alerts.map(a => `<div class="sum-row">${a}</div>`).join('') : '<p class="muted small">All caught up! 🎉</p>'}</div>
        <div class="card"><div class="card-h"><h3>Orders by status</h3></div><div class="status-list">
          ${Object.keys(st.byStatus).map(k => `<div class="srow">${statusBadge(k)}<b>${st.byStatus[k]}</b></div>`).join('')}</div></div>
      </div></div>`;
    $$('[data-g]', el).forEach(a => a.onclick = () => { sessionStorage.setItem('ff_og', a.dataset.g); });
  }
});

/* ---------- Orders ---------- */
page('/a/orders', {
  roles: A, title: 'Order Management', live: true,
  async render(el, p, rid) {
    const all = await api('GET', '/api/orders');
    if (rid !== S.renderId) return;
    let g = sessionStorage.getItem('ff_og') || 'All';
    if (!(g in ORDER_GROUPS)) g = 'All';
    const q = (sessionStorage.getItem('ff_oq') || '').toLowerCase();
    const inGroup = (o, k) => !ORDER_GROUPS[k] || ORDER_GROUPS[k].includes(o.status);
    const match = o => !q || o.code.toLowerCase().includes(q) || (o.customer && (o.customer.name.toLowerCase().includes(q) || o.customer.phone.includes(q))) || o.pickupAddress.area.toLowerCase().includes(q);
    const list = all.filter(o => inGroup(o, g) && match(o));
    el.innerHTML = `<div class="flex between wrap mb"><div class="tabs" style="margin:0">${Object.keys(ORDER_GROUPS).map(k => `<div class="tab ${k === g ? 'active' : ''}" data-g="${k}">${k}<span class="cnt">${all.filter(o => inGroup(o, k)).length}</span></div>`).join('')}</div>
      <input id="oq" placeholder="🔍 Search code, customer, phone, area" style="max-width:300px" value="${esc(q)}"></div>
      <div class="card">${ordersTable(list)}</div>`;
    $$('.tab', el).forEach(t => t.onclick = () => { sessionStorage.setItem('ff_og', t.dataset.g); this.render(el, p, rid); });
    let tm;
    $('#oq').oninput = e => { clearTimeout(tm); tm = setTimeout(() => { sessionStorage.setItem('ff_oq', e.target.value); this.render(el, p, rid).then(() => { const i = $('#oq'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }); }, 300); };
  }
});

page('/a/order/:id', { roles: A, title: 'Manage Order', nav: '/a/orders', live: true, render: (el, p, rid) => renderOrderDetail(el, p.id, rid) });

const NEXT_ADMIN = { picked_up: ['at_laundry', '🏭 Mark Received at Laundry'], at_laundry: ['processing', '🫧 Start Processing'], processing: ['ready', '✨ Mark Ready for Delivery'] };

function adminOrderActions() { return '<div id="adm-actions"><div class="muted small">Loading actions…</div></div>'; }

async function bindAdminOrderActions(el, o) {
  const box = $('#adm-actions', el);
  const riders = (await api('GET', '/api/admin/users?role=rider')).filter(r => r.approved && r.status === 'active');
  if (!document.body.contains(box)) return;
  const area = o.status === 'ready' || o.status === 'delivery_assigned' ? o.deliveryAddress.area : o.pickupAddress.area;
  riders.sort((a, b) => (b.available - a.available) || ((b.area === area) - (a.area === area)) || (a.activeTasks - b.activeTasks));
  const riderOpts = sel => riders.map(r => `<option value="${r.id}" ${sel && sel.id === r.id ? 'selected' : ''}>${r.available ? '🟢' : '⚫'} ${esc(r.name)} — ${esc(r.area || '')} (${r.activeTasks} active)</option>`).join('');
  const closed = ['delivered', 'cancelled'].includes(o.status);
  let h = '<div class="card-h"><h3>⚙️ Manage Order</h3></div>';
  if (['pending', 'pickup_assigned'].includes(o.status)) {
    h += `<div class="field"><label>📦 ${o.pickupRider ? 'Re-assign' : 'Assign'} pickup rider <span class="muted">(area: ${esc(o.pickupAddress.area)})</span></label>
      ${riders.length ? `<div class="flex"><select id="pr">${riderOpts(o.pickupRider)}</select><button class="btn" id="pr-go">Assign</button></div>` : '<div class="small muted">No approved riders available.</div>'}</div>`;
  }
  if (NEXT_ADMIN[o.status]) h += `<button class="btn block mb" id="next-st" data-st="${NEXT_ADMIN[o.status][0]}">${NEXT_ADMIN[o.status][1]}</button>`;
  if (['ready', 'delivery_assigned'].includes(o.status)) {
    h += `<div class="field"><label>🚚 ${o.deliveryRider ? 'Re-assign' : 'Assign'} delivery rider <span class="muted">(area: ${esc(o.deliveryAddress.area)})</span></label>
      ${riders.length ? `<div class="flex"><select id="dr">${riderOpts(o.deliveryRider || o.pickupRider)}</select><button class="btn" id="dr-go">Assign</button></div>` : '<div class="small muted">No approved riders available.</div>'}</div>`;
  }
  h += `<details class="mb"><summary class="small" style="cursor:pointer;font-weight:600">Manual status override</summary>
      <div class="mt"><select id="ms">${Object.keys(S.config.statusLabels).filter(k => k !== 'cancelled').map(k => `<option value="${k}" ${k === o.status ? 'selected' : ''}>${esc(S.config.statusLabels[k])}</option>`).join('')}</select>
      <input id="ms-note" class="mt" placeholder="Note for customer (optional)"><button class="btn sm outline mt" id="ms-go">Update status</button></div></details>`;
  h += `<div class="field"><label>💳 Payment status</label><div class="flex"><select id="ps">${Object.keys(PAY_LABEL).map(k => `<option value="${k}" ${k === o.paymentStatus ? 'selected' : ''}>${PAY_LABEL[k]}</option>`).join('')}</select><button class="btn outline" id="ps-go">Save</button></div>
    ${o.codCollectedBy ? `<div class="small mt">${o.codSettled ? '✅ Cash settled with office' : '⚠️ Cash held by rider — not yet settled'}</div>` : ''}</div>`;
  if (!closed) h += '<button class="btn danger block" id="a-cancel">Cancel Order</button>';
  box.innerHTML = h;

  const post = (btn, url, body, msg) => busy(btn, async () => { await api('POST', url, body); toast(msg); refreshPage(); });
  const on = (id, fn) => { const b = $('#' + id, box); if (b) b.onclick = () => fn(b); };
  on('pr-go', b => post(b, '/api/admin/orders/' + o.id + '/assign', { type: 'pickup', riderId: $('#pr', box).value }, 'Pickup rider assigned'));
  on('dr-go', b => post(b, '/api/admin/orders/' + o.id + '/assign', { type: 'delivery', riderId: $('#dr', box).value }, 'Delivery rider assigned'));
  on('next-st', b => post(b, '/api/admin/orders/' + o.id + '/status', { status: b.dataset.st }, 'Status updated'));
  on('ms-go', b => post(b, '/api/admin/orders/' + o.id + '/status', { status: $('#ms', box).value, note: $('#ms-note', box).value }, 'Status updated'));
  on('ps-go', b => busy(b, async () => { await api('PUT', '/api/admin/orders/' + o.id + '/payment', { paymentStatus: $('#ps', box).value }); toast('Payment updated'); refreshPage(); }));
  on('a-cancel', async b => {
    const m = modal({
      title: 'Cancel order ' + esc(o.code),
      body: '<div class="field"><label>Reason (visible to customer)</label><input id="cr" placeholder="e.g. Customer unreachable"></div>',
      foot: '<button class="btn ghost" data-close>Back</button><button class="btn danger" id="cr-go">Cancel Order</button>',
      onMount: mm => { $('#cr-go', mm.el).onclick = e => busy(e.target, async () => { await api('POST', '/api/orders/' + o.id + '/cancel', { reason: $('#cr', mm.el).value }); mm.close(); toast('Order cancelled'); refreshPage(); }); }
    });
    return m;
  });
}

/* ---------- Customers ---------- */
page('/a/customers', {
  roles: A, title: 'Customers',
  async render(el, p, rid) {
    const list = await api('GET', '/api/admin/users?role=customer');
    if (rid !== S.renderId) return;
    el.innerHTML = `<div class="flex between mb"><input id="cq" placeholder="🔍 Search name, email, phone" style="max-width:320px"><button class="btn" id="add-c">+ Add Customer</button></div>
      <div class="card"><div class="table-wrap"><table><thead><tr><th>Customer</th><th>Phone</th><th>Orders</th><th>Total spent</th><th>Joined</th><th>Status</th><th></th></tr></thead><tbody id="ctb"></tbody></table></div></div>`;
    const draw = q => {
      q = (q || '').toLowerCase();
      const rows = list.filter(u => !q || u.name.toLowerCase().includes(q) || u.email.includes(q) || (u.phone || '').includes(q));
      $('#ctb').innerHTML = rows.length ? rows.map(u => `<tr><td><div class="flex"><div class="avatar">${initials(u.name)}</div><div><b>${esc(u.name)}</b><div class="small muted">${esc(u.email)}</div></div></div></td>
        <td>${esc(u.phone)}</td><td>${u.orderCount}</td><td>${money(u.totalSpent)}</td><td class="small">${fmtDate(u.createdAt)}</td><td>${badge(u.status, u.status)}</td>
        <td class="right"><button class="btn sm ghost" data-view="${u.id}">View</button> <button class="btn sm ${u.status === 'active' ? 'danger' : 'success'}" data-tog="${u.id}">${u.status === 'active' ? 'Block' : 'Unblock'}</button></td></tr>`).join('')
        : `<tr><td colspan="7">${emptyState('👥', 'No customers found.')}</td></tr>`;
      $$('[data-tog]', el).forEach(b => b.onclick = async () => {
        const u = list.find(x => x.id === Number(b.dataset.tog));
        const ns = u.status === 'active' ? 'blocked' : 'active';
        if (!(await confirmBox(`${ns === 'blocked' ? 'Block' : 'Unblock'} <b>${esc(u.name)}</b>?`, ns === 'blocked' ? 'Block' : 'Unblock', ns === 'blocked'))) return;
        busy(b, async () => { await api('PUT', '/api/admin/users/' + u.id, { status: ns }); toast('Customer ' + ns); refreshPage(); });
      });
      $$('[data-view]', el).forEach(b => b.onclick = () => viewCustomer(list.find(x => x.id === Number(b.dataset.view))));
    };
    draw();
    $('#cq').oninput = e => draw(e.target.value);
    $('#add-c').onclick = () => userModal('customer');
  }
});

async function viewCustomer(u) {
  const orders = (await api('GET', '/api/orders')).filter(o => o.customer && o.customer.id === u.id);
  modal({
    title: '👤 ' + esc(u.name), wide: true,
    body: `<dl class="kv"><dt>Email</dt><dd>${esc(u.email)}</dd><dt>Phone</dt><dd>${esc(u.phone)}</dd><dt>Joined</dt><dd>${fmtDate(u.createdAt)}</dd><dt>Total spent</dt><dd>${money(u.totalSpent)}</dd></dl>
      <h4 class="mt">Addresses</h4>${(u.addresses || []).length ? u.addresses.map(a => `<div class="small">📍 <b>${esc(a.label)}</b>: ${addrText(a)}</div>`).join('') : '<div class="muted small">None</div>'}
      <h4 class="mt">Orders (${orders.length})</h4>${orders.length ? `<table><tbody>${orders.map(o => `<tr><td><a href="#/a/order/${o.id}" data-close>${esc(o.code)}</a></td><td class="small">${fmtDate(o.createdAt)}</td><td>${money(o.total)}</td><td>${statusBadge(o.status)}</td></tr>`).join('')}</tbody></table>` : '<div class="muted small">No orders yet</div>'}`
  });
}

function userModal(role, onDone) {
  const rider = role === 'rider';
  modal({
    title: 'Add ' + role.charAt(0).toUpperCase() + role.slice(1),
    body: `<form id="uf"><div class="grid2"><div class="field"><label>Full name</label><input name="name" required></div><div class="field"><label>Phone</label><input name="phone" required></div></div>
      <div class="grid2"><div class="field"><label>Email</label><input name="email" type="email" required></div><div class="field"><label>Password</label><input name="password" minlength="6" required value=""></div></div>
      ${rider ? `<div class="grid2"><div class="field"><label>Vehicle</label><select name="vehicle">${['Motorbike', 'Bicycle', 'Scooter', 'Car', 'Van'].map(v => `<option>${v}</option>`).join('')}</select></div><div class="field"><label>Vehicle number</label><input name="vehicleNumber"></div></div>
      <div class="grid2"><div class="field"><label>Area</label><select name="area">${areaOptions()}</select></div><div class="field"><label>NID</label><input name="nid"></div></div>` : ''}</form>`,
    foot: '<button class="btn ghost" data-close>Cancel</button><button class="btn" id="uf-go">Create</button>',
    onMount: m => {
      $('#uf-go', m.el).onclick = e => {
        const f = $('#uf', m.el);
        if (!f.reportValidity()) return;
        busy(e.target, async () => { await api('POST', '/api/admin/users', Object.assign(formData(f), { role })); m.close(); toast(role + ' account created'); onDone ? onDone() : refreshPage(); });
      };
    }
  });
}

/* ---------- Riders ---------- */
page('/a/riders', {
  roles: A, title: 'Rider Management',
  async render(el, p, rid) {
    const list = await api('GET', '/api/admin/users?role=rider');
    if (rid !== S.renderId) return;
    const groups = {
      Approved: list.filter(r => r.approved && r.status === 'active'),
      Pending: list.filter(r => !r.approved && r.status === 'active'),
      Blocked: list.filter(r => r.status === 'blocked'),
      All: list
    };
    let g = el.dataset.rg in groups ? el.dataset.rg : (groups.Pending.length ? 'Pending' : 'Approved');
    const rows = groups[g];
    el.innerHTML = `<div class="flex between wrap mb"><div class="tabs" style="margin:0">${Object.keys(groups).map(k => `<div class="tab ${k === g ? 'active' : ''}" data-g="${k}">${k}<span class="cnt">${groups[k].length}</span></div>`).join('')}</div><button class="btn" id="add-r">+ Add Rider</button></div>
      <div class="card"><div class="table-wrap"><table><thead><tr><th>Rider</th><th>Vehicle</th><th>Area</th><th>Status</th><th>Active</th><th>Done</th><th>Earnings</th><th>Cash in hand</th><th class="right">Actions</th></tr></thead><tbody>
      ${rows.length ? rows.map(r => `<tr><td><div class="flex"><div class="avatar">${initials(r.name)}</div><div><b>${esc(r.name)}</b><div class="small muted">${esc(r.phone)} · ${esc(r.email)}</div>${r.nid ? `<div class="small muted">NID: ${esc(r.nid)}</div>` : ''}</div></div></td>
        <td>${esc(r.vehicle || '-')}<div class="small muted">${esc(r.vehicleNumber || '')}</div></td><td>${esc(r.area || '-')}</td>
        <td>${r.status === 'blocked' ? badge('blocked', 'Blocked') : !r.approved ? badge('pending', 'Pending') : r.available ? badge('active', '🟢 Online') : badge('', '⚫ Offline')}</td>
        <td>${r.activeTasks}</td><td>${r.tasksCompleted}</td><td>${money(r.earnings)}</td>
        <td>${r.cashInHand ? `<b style="color:var(--err)">${money(r.cashInHand)}</b> <button class="btn sm success" data-settle="${r.id}">Settle</button>` : money(0)}</td>
        <td class="right" style="white-space:nowrap">
          ${r.status === 'active' ? (r.approved ? `<button class="btn sm ghost" data-appr="${r.id}" data-v="0">Revoke</button>` : `<button class="btn sm success" data-appr="${r.id}" data-v="1">Approve</button>`) : ''}
          <button class="btn sm ghost" data-pw="${r.id}" title="Reset password">🔑</button>
          <button class="btn sm ${r.status === 'active' ? 'danger' : 'success'}" data-tog="${r.id}">${r.status === 'active' ? 'Block' : 'Unblock'}</button></td></tr>`).join('')
      : `<tr><td colspan="9">${emptyState('🛵', 'No riders in this list.')}</td></tr>`}</tbody></table></div></div>`;
    const find = id => list.find(r => r.id === Number(id));
    $$('.tab', el).forEach(t => t.onclick = () => { el.dataset.rg = t.dataset.g; this.render(el, p, rid); });
    $('#add-r').onclick = () => userModal('rider');
    $$('[data-appr]', el).forEach(b => b.onclick = () => busy(b, async () => { await api('PUT', '/api/admin/users/' + b.dataset.appr, { approved: b.dataset.v === '1' }); toast(b.dataset.v === '1' ? 'Rider approved' : 'Approval revoked'); refreshPage(); }));
    $$('[data-tog]', el).forEach(b => b.onclick = async () => {
      const r = find(b.dataset.tog), ns = r.status === 'active' ? 'blocked' : 'active';
      if (await confirmBox(`${ns === 'blocked' ? 'Block' : 'Unblock'} rider <b>${esc(r.name)}</b>?`, ns === 'blocked' ? 'Block' : 'Unblock', ns === 'blocked'))
        busy(b, async () => { await api('PUT', '/api/admin/users/' + r.id, { status: ns }); toast('Rider ' + ns); refreshPage(); });
    });
    $$('[data-settle]', el).forEach(b => b.onclick = async () => {
      const r = find(b.dataset.settle);
      if (await confirmBox(`Confirm you received <b>${money(r.cashInHand)}</b> cash from <b>${esc(r.name)}</b>?`, 'Mark Settled'))
        busy(b, async () => { const res = await api('POST', '/api/admin/riders/' + r.id + '/settle'); toast('Settled ' + money(res.settled)); refreshPage(); });
    });
    $$('[data-pw]', el).forEach(b => b.onclick = () => {
      const r = find(b.dataset.pw);
      modal({
        title: 'Reset password — ' + esc(r.name),
        body: '<div class="field"><label>New password</label><input id="npw" minlength="6"></div>',
        foot: '<button class="btn ghost" data-close>Cancel</button><button class="btn" id="npw-go">Reset</button>',
        onMount: m => { $('#npw-go', m.el).onclick = e => busy(e.target, async () => { await api('PUT', '/api/admin/users/' + r.id, { password: $('#npw', m.el).value }); m.close(); toast('Password reset'); }); }
      });
    });
  }
});

/* ---------- Services ---------- */
page('/a/services', {
  roles: A, title: 'Services & Pricing',
  async render(el, p, rid) {
    const list = await api('GET', '/api/admin/services');
    if (rid !== S.renderId) return;
    el.innerHTML = `<div class="flex between mb"><p class="muted" style="margin:0">Services shown to customers when placing orders.</p><button class="btn" id="add-s">+ Add Service</button></div>
      <div class="card"><div class="table-wrap"><table><thead><tr><th>Item</th><th>Category</th><th>Price</th><th>Unit</th><th>Visible</th><th class="right">Actions</th></tr></thead><tbody>
      ${list.length ? list.map(s => `<tr><td><span style="font-size:22px">${esc(s.icon)}</span> <b>${esc(s.name)}</b><div class="small muted">${esc(s.description || '')}</div></td><td>${esc(s.category)}</td><td><b>${money(s.price)}</b></td><td>${esc(s.unit)}</td>
        <td><label class="switch" style="transform:scale(.8)"><input type="checkbox" data-act="${s.id}" ${s.active ? 'checked' : ''}><span class="sl"></span></label></td>
        <td class="right"><button class="btn sm outline" data-edit="${s.id}">Edit</button> <button class="btn sm ghost" data-del="${s.id}">🗑️</button></td></tr>`).join('')
      : `<tr><td colspan="6">${emptyState('🧺', 'No services yet.')}</td></tr>`}</tbody></table></div></div>`;
    const reload = async () => { S.config = await api('GET', '/api/public/config'); refreshPage(); };
    $('#add-s').onclick = () => serviceModal(null, list, reload);
    $$('[data-edit]', el).forEach(b => b.onclick = () => serviceModal(list.find(s => s.id === Number(b.dataset.edit)), list, reload));
    $$('[data-act]', el).forEach(c => c.onchange = async () => { try { await api('PUT', '/api/admin/services/' + c.dataset.act, { active: c.checked }); toast(c.checked ? 'Service visible' : 'Service hidden'); reload(); } catch (e) { toast(e.message, 'error'); } });
    $$('[data-del]', el).forEach(b => b.onclick = async () => {
      if (await confirmBox('Delete this service permanently? Existing orders keep their item records.', 'Delete', true)) busy(b, async () => { await api('DELETE', '/api/admin/services/' + b.dataset.del); toast('Service deleted'); reload(); });
    });
  }
});

function serviceModal(s, list, done) {
  s = s || { unit: 'piece', icon: '🧺', active: true };
  const cats = [...new Set(list.map(x => x.category).concat(['Wash & Iron', 'Wash & Fold', 'Dry Cleaning', 'Iron Only', 'Shoe Care']))];
  modal({
    title: s.id ? 'Edit Service' : 'Add Service',
    body: `<form id="sf"><div class="grid2"><div class="field"><label>Name</label><input name="name" value="${esc(s.name || '')}" required></div>
      <div class="field"><label>Category</label><input name="category" list="cat-list" value="${esc(s.category || '')}" required><datalist id="cat-list">${cats.map(c => `<option value="${esc(c)}">`).join('')}</datalist></div></div>
      <div class="grid3"><div class="field"><label>Price (${esc(cur())})</label><input name="price" type="number" min="0" step="0.5" value="${s.price || ''}" required></div>
      <div class="field"><label>Unit</label><select name="unit">${['piece', 'kg', 'pair', 'set'].map(u => `<option ${u === s.unit ? 'selected' : ''}>${u}</option>`).join('')}</select></div>
      <div class="field"><label>Icon (emoji)</label><input name="icon" value="${esc(s.icon || '')}"></div></div>
      <div class="field"><label>Description</label><input name="description" value="${esc(s.description || '')}"></div>
      <label class="check"><input type="checkbox" name="active" ${s.active ? 'checked' : ''}> Visible to customers</label></form>`,
    foot: '<button class="btn ghost" data-close>Cancel</button><button class="btn" id="sf-go">Save</button>',
    onMount: m => {
      $('#sf-go', m.el).onclick = e => {
        const f = $('#sf', m.el);
        if (!f.reportValidity()) return;
        busy(e.target, async () => { await api(s.id ? 'PUT' : 'POST', '/api/admin/services' + (s.id ? '/' + s.id : ''), formData(f)); m.close(); toast('Service saved'); done(); });
      };
    }
  });
}

/* ---------- Coupons ---------- */
page('/a/coupons', {
  roles: A, title: 'Coupons & Offers',
  async render(el, p, rid) {
    const list = await api('GET', '/api/admin/coupons');
    if (rid !== S.renderId) return;
    el.innerHTML = `<div class="flex between mb"><p class="muted" style="margin:0">Discount codes customers can apply at checkout.</p><button class="btn" id="add-cp">+ New Coupon</button></div>
      <div class="card"><div class="table-wrap"><table><thead><tr><th>Code</th><th>Discount</th><th>Min order</th><th>Max discount</th><th>Expires</th><th>Used</th><th>Active</th><th class="right">Actions</th></tr></thead><tbody>
      ${list.length ? list.map(c => `<tr><td><b style="font-family:monospace;font-size:15px">${esc(c.code)}</b></td><td>${c.type === 'percent' ? c.value + '%' : money(c.value)}</td><td>${money(c.minOrder)}</td><td>${c.maxDiscount ? money(c.maxDiscount) : '—'}</td>
        <td class="small">${c.expiresAt ? fmtDate(c.expiresAt) : 'Never'}</td><td>${c.usedCount || 0}</td><td>${badge(c.active ? 'yes' : 'no', c.active ? 'Active' : 'Inactive')}</td>
        <td class="right"><button class="btn sm outline" data-edit="${c.id}">Edit</button> <button class="btn sm ghost" data-del="${c.id}">🗑️</button></td></tr>`).join('')
      : `<tr><td colspan="8">${emptyState('🎟️', 'No coupons yet.')}</td></tr>`}</tbody></table></div></div>`;
    const open = c => {
      c = c || { type: 'percent', active: true };
      modal({
        title: c.id ? 'Edit Coupon' : 'New Coupon',
        body: `<form id="cpf"><div class="grid2"><div class="field"><label>Code</label><input name="code" value="${esc(c.code || '')}" required style="text-transform:uppercase"></div>
          <div class="field"><label>Type</label><select name="type"><option value="percent" ${c.type === 'percent' ? 'selected' : ''}>Percentage (%)</option><option value="flat" ${c.type === 'flat' ? 'selected' : ''}>Flat amount</option></select></div></div>
          <div class="grid3"><div class="field"><label>Value</label><input name="value" type="number" min="0" value="${c.value || ''}" required></div>
          <div class="field"><label>Min order</label><input name="minOrder" type="number" min="0" value="${c.minOrder || 0}"></div>
          <div class="field"><label>Max discount (0 = none)</label><input name="maxDiscount" type="number" min="0" value="${c.maxDiscount || 0}"></div></div>
          <div class="field"><label>Expiry date</label><input name="expiresAt" type="date" value="${esc(c.expiresAt || '')}"></div>
          <label class="check"><input type="checkbox" name="active" ${c.active ? 'checked' : ''}> Active</label></form>`,
        foot: '<button class="btn ghost" data-close>Cancel</button><button class="btn" id="cpf-go">Save</button>',
        onMount: m => {
          $('#cpf-go', m.el).onclick = e => {
            const f = $('#cpf', m.el);
            if (!f.reportValidity()) return;
            busy(e.target, async () => { await api(c.id ? 'PUT' : 'POST', '/api/admin/coupons' + (c.id ? '/' + c.id : ''), formData(f)); m.close(); toast('Coupon saved'); refreshPage(); });
          };
        }
      });
    };
    $('#add-cp').onclick = () => open();
    $$('[data-edit]', el).forEach(b => b.onclick = () => open(list.find(c => c.id === Number(b.dataset.edit))));
    $$('[data-del]', el).forEach(b => b.onclick = async () => { if (await confirmBox('Delete this coupon?', 'Delete', true)) busy(b, async () => { await api('DELETE', '/api/admin/coupons/' + b.dataset.del); toast('Coupon deleted'); refreshPage(); }); });
  }
});

/* ---------- Settings ---------- */
page('/a/settings', {
  roles: A, title: 'System Settings',
  async render(el, p, rid) {
    const [s, admins] = await Promise.all([api('GET', '/api/admin/settings'), api('GET', '/api/admin/users?role=admin')]);
    if (rid !== S.renderId) return;
    el.innerHTML = `<div class="cols"><div><form id="setf">
      <div class="card"><div class="card-h"><h3>🏢 Business</h3></div>
        <div class="grid2"><div class="field"><label>Business name</label><input name="businessName" value="${esc(s.businessName)}"></div><div class="field"><label>Currency symbol</label><input name="currency" value="${esc(s.currency)}"></div></div>
        <div class="grid2"><div class="field"><label>Support phone</label><input name="supportPhone" value="${esc(s.supportPhone)}"></div><div class="field"><label>Support email</label><input name="supportEmail" value="${esc(s.supportEmail)}"></div></div></div>
      <div class="card"><div class="card-h"><h3>💰 Pricing & Fees</h3></div>
        <div class="grid3"><div class="field"><label>Pickup & delivery fee</label><input type="number" min="0" name="deliveryFee" value="${s.deliveryFee}"></div>
        <div class="field"><label>Free delivery above (0 = never)</label><input type="number" min="0" name="freeDeliveryAbove" value="${s.freeDeliveryAbove}"></div>
        <div class="field"><label>Minimum order amount</label><input type="number" min="0" name="minOrderAmount" value="${s.minOrderAmount}"></div></div>
        <div class="grid3"><div class="field"><label>Express surcharge (%)</label><input type="number" min="0" name="expressSurchargePercent" value="${s.expressSurchargePercent}"></div>
        <div class="field"><label>Rider fee per task</label><input type="number" min="0" name="riderFeePerTask" value="${s.riderFeePerTask}"></div>
        <div class="field"><label>Min advance prepayment (%)</label><input type="number" min="1" max="100" name="prepaymentMinPercent" value="${s.prepaymentMinPercent || 30}"></div></div></div>
      <div class="card"><div class="card-h"><h3>🗺️ Operations</h3></div>
        <div class="grid2"><div class="field"><label>Pickup time slots (one per line)</label><textarea name="timeSlots" rows="6">${esc(s.timeSlots.join('\n'))}</textarea></div>
        <div class="field"><label>Service areas (one per line)</label><textarea name="serviceAreas" rows="6">${esc(s.serviceAreas.join('\n'))}</textarea></div></div></div>
      <button class="btn lg mt">💾 Save Settings</button></form></div>
      <div><div class="card"><div class="card-h"><h3>🛡️ Administrators</h3><button class="btn sm" id="add-ad">+ Add</button></div>
        ${admins.map(a => `<div class="flex" style="margin-bottom:10px"><div class="avatar">${initials(a.name)}</div><div class="grow"><b>${esc(a.name)}</b><div class="small muted">${esc(a.email)}</div></div>${badge(a.status, a.status)}</div>`).join('')}</div>
      <div class="card"><div class="card-h"><h3>ℹ️ System</h3></div><p class="small muted">Data is stored in <code>data/db.json</code>. Back up this file regularly. Run <code>npm run reset</code> to restore demo data.</p></div></div></div>`;
    $('#setf').onsubmit = e => {
      e.preventDefault();
      busy(e.submitter, async () => {
        await api('PUT', '/api/admin/settings', formData(e.target));
        S.config = await api('GET', '/api/public/config');
        $('#shell').dataset.role = '';
        toast('Settings saved');
        router();
      });
    };
    $('#add-ad').onclick = () => userModal('admin');
  }
});

page('/a/profile', { roles: A, title: 'My Profile', render: el => renderProfile(el) });

