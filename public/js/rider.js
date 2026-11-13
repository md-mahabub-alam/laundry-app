'use strict';
/* ================= Rider pages ================= */
const R = ['rider'];
const RF = {
  pickup_assigned: ['pickupRider', 'Mark as Picked Up', '📦'],
  picked_up: ['pickupRider', 'Dropped at Laundry', '🏭'],
  delivery_assigned: ['deliveryRider', 'Start Delivery', '🚚'],
  out_for_delivery: ['deliveryRider', 'Mark as Delivered', '✅']
};
function myTask(o) {
  const f = RF[o.status];
  if (!f) return null;
  const r = o[f[0]];
  if (!r || r.id !== S.user.id) return null;
  return { type: f[0] === 'pickupRider' ? 'pickup' : 'delivery', label: f[1], icon: f[2] };
}

function advanceTask(o, btn) {
  const t = myTask(o);
  if (!t) return;
  const go = (extra) => busy(btn, async () => {
    await api('POST', '/api/rider/orders/' + o.id + '/advance', extra || {});
    toast(t.icon + ' ' + o.code + ' updated');
    refreshPage();
  });
  const due = o.dueAmount !== undefined ? o.dueAmount : (o.paymentStatus === 'paid' ? 0 : o.total);
  if (o.status === 'out_for_delivery' && due > 0 && o.paymentStatus !== 'paid') {
    modal({
      title: '💵 Collect Cash on Delivery',
      body: `<p>Collect <b style="font-size:22px;color:var(--err)">${money(due)}</b> from <b>${esc(o.customer ? o.customer.name : 'customer')}</b> before confirming delivery.</p>
        ${o.paidAmount > 0 ? `<div class="notice info small">⚡ Customer already prepaid <b>${money(o.paidAmount)}</b> online (Total bill: ${money(o.total)}). Collect only the remaining due of <b>${money(due)}</b>.</div>` : ''}
        <label class="check"><input type="checkbox" id="cash-ok"> I have collected ${money(due)} in cash</label>
        <div class="field mt"><label>Note (optional)</label><input id="d-note" placeholder="e.g. Handed to security guard"></div>`,
      foot: '<button class="btn ghost" data-close>Cancel</button><button class="btn success" id="d-ok">Confirm Delivery</button>',
      onMount: m => {
        $('#d-ok', m.el).onclick = () => {
          if (!$('#cash-ok', m.el).checked) return toast('Please confirm cash collection', 'error');
          const note = $('#d-note', m.el).value; m.close(); go({ cashCollected: true, note });
        };
      }
    });
  } else {
    confirmBox(`${t.icon} <b>${esc(t.label)}</b> for order <b>${esc(o.code)}</b>?`, t.label).then(ok => { if (ok) go(); });
  }
}

function taskCard(o) {
  const t = myTask(o);
  const a = t.type === 'pickup' ? o.pickupAddress : o.deliveryAddress;
  const qty = o.items.length;
  const due = o.dueAmount !== undefined ? o.dueAmount : (o.paymentStatus === 'paid' ? 0 : o.total);
  const cod = due > 0 && o.paymentStatus !== 'paid';
  return `<div class="task ${t.type}">
    <div class="flex between wrap"><div class="flex"><span class="task-type">${t.type.toUpperCase()}</span><b>${esc(o.code)}</b>${o.express ? '<span class="badge b-ready">⚡ Express</span>' : ''}</div>${statusBadge(o.status)}</div>
    <div class="grid2 mt"><div>
      <div style="font-weight:600">👤 ${esc(o.customer.name)}</div>
      <div class="small"><a href="tel:${esc(a.phone || o.customer.phone)}">📞 ${esc(a.phone || o.customer.phone)}</a></div>
      <div class="small mt">📍 ${addrText(a)} · <a target="_blank" href="${mapLink(a)}">Navigate ↗</a></div></div>
    <div class="small">
      ${t.type === 'pickup' ? `<div>🗓️ ${fmtDate(o.pickupDate)} · ${esc(o.pickupSlot)}</div>` : ''}
      <div>🧺 ${qty} item type(s)</div>
      <div>${cod ? `💵 <b style="color:var(--err)">Collect ${money(due)} cash</b>${o.paidAmount > 0 ? ` <span class="muted">(Prepaid ${money(o.paidAmount)})</span>` : ''}` : `💳 <b style="color:var(--ok)">Paid Online (${money(o.total)})</b>`}</div>
      ${o.notes ? `<div>📝 ${esc(o.notes)}</div>` : ''}</div></div>
    <div class="flex mt wrap"><button class="btn ${t.type === 'delivery' ? 'success' : 'accent'}" data-adv="${o.id}">${t.icon} ${esc(t.label)}</button><a class="btn ghost" href="#/r/order/${o.id}">View details</a></div>
  </div>`;
}

page('/r/dashboard', {
  roles: R, title: 'My Tasks', live: true,
  async render(el, p, rid) {
    const me = await api('GET', '/api/me');
    S.user = me;
    if (!me.approved) {
      if (rid !== S.renderId) return;
      el.innerHTML = `<div class="card">${emptyState('⏳', '<h3>Your rider account is under review</h3><p class="muted">An admin will verify your details shortly. You will get a notification once approved.</p>')}</div>`;
      return;
    }
    const [sum, orders] = await Promise.all([api('GET', '/api/rider/summary'), api('GET', '/api/orders')]);
    if (rid !== S.renderId) return;
    const tasks = orders.filter(myTask);
    const pickups = tasks.filter(o => myTask(o).type === 'pickup'), deliveries = tasks.filter(o => myTask(o).type === 'delivery');
    el.innerHTML = `
      <div class="online-card ${me.available ? 'on' : ''}"><div><h3 style="margin:0">${me.available ? '🟢 You are Online' : '⚫ You are Offline'}</h3>
        <div class="small" style="opacity:.9">${me.available ? 'Admin can assign you new pickup & delivery tasks.' : 'Go online to start receiving tasks.'}</div></div>
        <label class="switch"><input type="checkbox" id="avail" ${me.available ? 'checked' : ''}><span class="sl"></span></label></div>
      <div class="stats">
        <div class="stat"><div class="ic">📋</div><div><div class="v">${sum.activeTasks}</div><div class="l">Active tasks</div></div></div>
        <div class="stat"><div class="ic">💰</div><div><div class="v">${money(sum.todayEarnings)}</div><div class="l">Today's earnings</div></div></div>
        <div class="stat"><div class="ic">✅</div><div><div class="v">${sum.tasksCompleted}</div><div class="l">Tasks completed</div></div></div>
        <div class="stat"><div class="ic">💵</div><div><div class="v">${money(sum.cashInHand)}</div><div class="l">Cash in hand (to deposit)</div></div></div>
        <div class="stat"><div class="ic">⭐</div><div><div class="v">${sum.rating || '—'}</div><div class="l">Rating</div></div></div>
      </div>
      <div class="card"><div class="card-h"><h3>📦 Pickups (${pickups.length})</h3></div>${pickups.length ? pickups.map(taskCard).join('') : emptyState('🛵', 'No pickup tasks right now.')}</div>
      <div class="card"><div class="card-h"><h3>🚚 Deliveries (${deliveries.length})</h3></div>${deliveries.length ? deliveries.map(taskCard).join('') : emptyState('🏠', 'No delivery tasks right now.')}</div>`;
    $('#avail').onchange = async e => {
      try { S.user = await api('PUT', '/api/rider/availability', { available: e.target.checked }); toast(S.user.available ? 'You are online' : 'You are offline'); refreshPage(); }
      catch (err) { toast(err.message, 'error'); e.target.checked = !e.target.checked; }
    };
    $$('[data-adv]', el).forEach(b => b.onclick = () => advanceTask(tasks.find(o => o.id === Number(b.dataset.adv)), b));
  }
});

page('/r/order/:id', { roles: R, title: 'Task Details', nav: '/r/dashboard', live: true, render: (el, p, rid) => renderOrderDetail(el, p.id, rid) });

function riderOrderActions(o) {
  const t = myTask(o);
  if (!t) return '<div class="card-h"><h3>Task</h3></div><p class="muted small">No pending action for you on this order.</p>';
  return `<div class="card-h"><h3>⚡ Your Action</h3><span class="task-type" style="background:${t.type === 'pickup' ? 'var(--accent)' : 'var(--ok)'}">${t.type.toUpperCase()}</span></div>
    <button class="btn block lg ${t.type === 'delivery' ? 'success' : 'accent'}" id="r-adv">${t.icon} ${esc(t.label)}</button>
    <a class="btn outline block mt" target="_blank" href="${mapLink(t.type === 'pickup' ? o.pickupAddress : o.deliveryAddress)}">🧭 Navigate</a>`;
}
function bindRiderOrderActions(el, o) {
  const b = $('#r-adv', el);
  if (b) b.onclick = () => advanceTask(o, b);
}

page('/r/history', {
  roles: R, title: 'Task History',
  async render(el, p, rid) {
    const orders = await api('GET', '/api/orders');
    if (rid !== S.renderId) return;
    el.innerHTML = `<div class="card"><div class="card-h"><h3>All assigned orders</h3><span class="muted small">${orders.length} orders</span></div>
      ${orders.length ? `<div class="table-wrap"><table><thead><tr><th>Order</th><th>My role</th><th>Customer</th><th>Area</th><th>Amount</th><th>Status</th><th>Updated</th></tr></thead><tbody>
      ${orders.map(o => {
        const roles = [];
        if (o.pickupRider && o.pickupRider.id === S.user.id) roles.push('Pickup');
        if (o.deliveryRider && o.deliveryRider.id === S.user.id) roles.push('Delivery');
        return `<tr style="cursor:pointer" onclick="navigate('/r/order/${o.id}')"><td><b>${esc(o.code)}</b></td><td>${roles.join(' + ')}</td><td>${esc(o.customer.name)}</td><td>${esc(o.pickupAddress.area)}</td><td>${money(o.total)}</td><td>${statusBadge(o.status)}</td><td class="small muted">${fmtDT(o.updatedAt)}</td></tr>`;
      }).join('')}</tbody></table></div>` : emptyState('📋', 'No tasks yet.')}</div>`;
  }
});

page('/r/earnings', {
  roles: R, title: 'Earnings',
  async render(el, p, rid) {
    const s = await api('GET', '/api/rider/summary');
    if (rid !== S.renderId) return;
    el.innerHTML = `<div class="stats">
      <div class="stat"><div class="ic">💰</div><div><div class="v">${money(s.totalEarnings)}</div><div class="l">Total earnings</div></div></div>
      <div class="stat"><div class="ic">📅</div><div><div class="v">${money(s.todayEarnings)}</div><div class="l">Today</div></div></div>
      <div class="stat"><div class="ic">✅</div><div><div class="v">${s.tasksCompleted}</div><div class="l">Completed tasks</div></div></div>
      <div class="stat"><div class="ic">💵</div><div><div class="v">${money(s.cashInHand)}</div><div class="l">Cash to deposit</div></div></div></div>
      ${s.cashInHand ? `<div class="notice">💵 You are holding <b>${money(s.cashInHand)}</b> in collected cash. Please deposit it to the office; admin will mark it as settled.</div>` : ''}
      <div class="card"><div class="card-h"><h3>Earning history</h3><span class="small muted">${money(S.config.settings.riderFeePerTask)} per completed task</span></div>
      ${s.earnings.length ? `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Order</th><th>Task</th><th class="right">Amount</th></tr></thead><tbody>
        ${s.earnings.map(e => `<tr><td>${fmtDT(e.at)}</td><td><a href="#/r/order/${e.orderId}">${esc(e.orderCode)}</a></td><td>${e.type === 'pickup' ? '📦 Pickup' : '🚚 Delivery'}</td><td class="right"><b>${money(e.amount)}</b></td></tr>`).join('')}
      </tbody></table></div>` : emptyState('💰', 'Complete tasks to start earning.')}</div>`;
  }
});

page('/r/profile', { roles: R, title: 'My Profile', render: el => renderProfile(el) });

