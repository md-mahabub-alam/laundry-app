'use strict';
/* ================= Customer pages ================= */
const C = ['customer'];
const ACTIVE_ST = ['pending', 'pickup_assigned', 'picked_up', 'at_laundry', 'processing', 'ready', 'delivery_assigned', 'out_for_delivery'];
const NO = { cart: {}, express: false, coupon: '', pickupAddrId: null, deliverySame: true, deliveryAddrId: null, date: '', slot: '', payment: 'online', prepayPct: 50, prepayCustom: '', provider: 'bKash', notes: '', quote: null, cat: 'All' };
const svcById = id => S.config.services.find(s => s.id === Number(id));

function orderCard(o, base) {
  const n = o.items.reduce((a, i) => a + (i.unit === 'kg' ? 1 : i.qty), 0);
  const due = o.dueAmount !== undefined ? o.dueAmount : (o.paymentStatus === 'paid' ? 0 : o.total);
  const payTag = o.paymentStatus === 'paid'
    ? '<span class="badge b-paid">💳 Paid</span>'
    : o.paymentStatus === 'partial'
      ? `<span class="badge b-ready">⚡ Prepaid ${money(o.paidAmount)} · Due ${money(due)}</span>`
      : `<span class="badge b-pending">💵 COD · Due ${money(due)}</span>`;
  return `<div class="order-card" onclick="navigate('${base}${o.id}')">
    <div class="flex between wrap"><div><b>${esc(o.code)}</b> ${o.express ? '<span class="badge b-ready">⚡</span>' : ''} ${payTag}<div class="small muted">${fmtDT(o.createdAt)}</div></div>${statusBadge(o.status)}</div>
    <div class="flex between mt small"><span class="muted">${n} item(s) · Pickup ${fmtDate(o.pickupDate)}, ${esc(o.pickupSlot)}</span><b style="font-size:16px">${money(o.total)}</b></div>
    ${o.status !== 'cancelled' ? `<div class="mini-progress"><div style="width:${progressPct(o.status)}%"></div></div>` : ''}
  </div>`;
}

/* ---------- Dashboard ---------- */
page('/c/dashboard', {
  roles: C, title: 'Dashboard', live: true,
  async render(el, p, rid) {
    const orders = await api('GET', '/api/orders');
    if (rid !== S.renderId) return;
    const active = orders.filter(o => ACTIVE_ST.includes(o.status));
    const spent = orders.filter(o => o.status === 'delivered').reduce((a, o) => a + o.total, 0);
    const s = S.config.settings;
    el.innerHTML = `
      <div class="card mb" style="background:linear-gradient(135deg,#0e7c86,#0f2e3a);color:#fff;border:none">
        <div class="flex between wrap"><div><h2 style="margin:0">Hi ${esc(S.user.name.split(' ')[0])} 👋</h2><p style="margin:6px 0 0;opacity:.9">Ready for fresh clothes? Schedule a pickup and we'll handle the rest.</p></div>
        <a class="btn accent lg" href="#/c/new">🧺 Schedule Pickup</a></div></div>
      <div class="stats">
        <div class="stat"><div class="ic">🚚</div><div><div class="v">${active.length}</div><div class="l">Active orders</div></div></div>
        <div class="stat"><div class="ic">📦</div><div><div class="v">${orders.length}</div><div class="l">Total orders</div></div></div>
        <div class="stat"><div class="ic">✅</div><div><div class="v">${orders.filter(o => o.status === 'delivered').length}</div><div class="l">Delivered</div></div></div>
        <div class="stat"><div class="ic">💰</div><div><div class="v">${money(spent)}</div><div class="l">Total spent</div></div></div>
      </div>
      <div class="cols"><div>
        <div class="card"><div class="card-h"><h3>Active Orders</h3><a href="#/c/orders">View all →</a></div>
          ${active.length ? `<div class="order-list">${active.map(o => orderCard(o, '/c/order/')).join('')}</div>` : emptyState('🧺', 'No active orders right now.', '<a class="btn mt" href="#/c/new">Place your first order</a>')}
        </div></div>
        <div><div class="card"><div class="card-h"><h3>🎁 Offers</h3></div>
          <p class="small">Use code <b>WELCOME20</b> for 20% off your order (min ${money(300)}).</p>
          <p class="small">Free pickup & delivery on orders above <b>${money(s.freeDeliveryAbove)}</b>.</p>
          <p class="small">⚡ Express service: +${s.expressSurchargePercent}% for priority cleaning.</p></div>
        <div class="card"><div class="card-h"><h3>Popular Services</h3></div>
          ${S.config.services.slice(0, 6).map(v => `<div class="sum-row"><span>${esc(v.icon)} ${esc(v.name)}</span><b>${money(v.price)}/${esc(v.unit)}</b></div>`).join('')}</div>
      </div></div>`;
  }
});

/* ---------- Orders list ---------- */
page('/c/orders', {
  roles: C, title: 'My Orders', live: true,
  async render(el, p, rid) {
    const orders = await api('GET', '/api/orders');
    if (rid !== S.renderId) return;
    const groups = { Active: orders.filter(o => ACTIVE_ST.includes(o.status)), Delivered: orders.filter(o => o.status === 'delivered'), Cancelled: orders.filter(o => o.status === 'cancelled'), All: orders };
    const tab = el.dataset.tab && groups[el.dataset.tab] ? el.dataset.tab : 'Active';
    el.innerHTML = `<div class="tabs">${Object.keys(groups).map(k => `<div class="tab ${k === tab ? 'active' : ''}" data-t="${k}">${k}<span class="cnt">${groups[k].length}</span></div>`).join('')}</div>
      <div class="order-list">${groups[tab].length ? groups[tab].map(o => orderCard(o, '/c/order/')).join('') : `<div class="card">${emptyState('📭', 'No orders here.', '<a class="btn mt" href="#/c/new">Schedule a pickup</a>')}</div>`}</div>`;
    $$('.tab', el).forEach(t => t.onclick = () => { el.dataset.tab = t.dataset.t; this.render(el, p, rid); });
  }
});

page('/c/order/:id', { roles: C, title: 'Order Details', nav: '/c/orders', live: true, render: (el, p, rid) => renderOrderDetail(el, p.id, rid) });

function customerOrderActions(o) {
  const due = o.dueAmount !== undefined ? o.dueAmount : (o.paymentStatus === 'paid' ? 0 : o.total);
  let h = '<div class="card-h"><h3>⚡ Actions</h3></div>';
  if (due > 0 && !['cancelled', 'delivered'].includes(o.status)) {
    h += `<button class="btn success block mb" id="act-pay-now">💳 Pay Online Now (${money(due)})</button>`;
  }
  if (['pending', 'pickup_assigned'].includes(o.status)) h += '<button class="btn danger block" id="c-cancel">Cancel Order</button><p class="small muted">You can cancel until the rider picks up your items.</p>';
  if (o.status === 'delivered' && !o.rating) {
    h += `<form id="rate-f"><label>Rate our service</label><div class="star-pick" data-name="rating">${[1, 2, 3, 4, 5].map(i => `<span data-v="${i}">★</span>`).join('')}</div>
      <label class="mt">Rate your rider</label><div class="star-pick" data-name="riderRating">${[1, 2, 3, 4, 5].map(i => `<span data-v="${i}">★</span>`).join('')}</div>
      <div class="field mt"><textarea name="review" placeholder="Tell us about your experience (optional)"></textarea></div>
      <button class="btn block">Submit Feedback</button></form>`;
  }
  h += '<button class="btn outline block mt" id="c-reorder">🔁 Reorder same items</button>';
  h += `<p class="small muted center">Need help? Call ${esc(S.config.settings.supportPhone)}</p>`;
  return h;
}
function bindCustomerOrderActions(el, o) {
  const due = o.dueAmount !== undefined ? o.dueAmount : (o.paymentStatus === 'paid' ? 0 : o.total);
  const payOrderOnline = amount => {
    paymentModal(amount, { provider: o.paymentProvider && o.paymentProvider !== 'Cash on Delivery' ? o.paymentProvider : 'bKash', label: amount < due ? 'Advance Prepayment for ' + o.code : 'Full Due Payment for ' + o.code }, async payRes => {
      await api('POST', '/api/orders/' + o.id + '/pay', { amount, provider: payRes.provider, account: payRes.account, transactionId: payRes.transactionId });
      toast('✅ Payment of ' + money(amount) + ' confirmed via ' + payRes.provider + '!');
      refreshPage();
    });
  };
  ['act-pay-now', 'c-pay-full'].forEach(id => {
    const b = $('#' + id, el);
    if (b) b.onclick = () => payOrderOnline(due);
  });
  const partBtn = $('#c-pay-part', el);
  if (partBtn) partBtn.onclick = () => {
    const minP = Math.max(1, Math.round(due * ((S.config.settings.prepaymentMinPercent || 30) / 100)));
    const defP = Math.round(due * 0.5);
    modal({
      title: '⚡ Make Advance Prepayment — ' + esc(o.code),
      body: `<p class="small muted">Pay an advance online now and pay the remaining balance via Cash on Delivery.</p>
        <div class="opt-grid mb" id="pp-picks">
          <div class="opt" data-amt="${Math.round(due * 0.3)}">30% Advance<small>${money(Math.round(due * 0.3))}</small></div>
          <div class="opt sel" data-amt="${defP}">50% Advance<small>${money(defP)}</small></div>
          <div class="opt" data-amt="${Math.round(due * 0.7)}">70% Advance<small>${money(Math.round(due * 0.7))}</small></div>
        </div>
        <div class="field"><label>Advance amount to pay now (min ${money(minP)}, max ${money(due)})</label>
          <input type="number" id="pp-amt" min="${minP}" max="${due}" value="${defP}"></div>`,
      foot: '<button class="btn ghost" data-close>Cancel</button><button class="btn success" id="pp-cont">Continue to Gateway →</button>',
      onMount: m => {
        $$('#pp-picks .opt', m.el).forEach(op => op.onclick = () => {
          $$('#pp-picks .opt', m.el).forEach(x => x.classList.toggle('sel', x === op));
          $('#pp-amt', m.el).value = op.dataset.amt;
        });
        $('#pp-cont', m.el).onclick = () => {
          const val = +Number($('#pp-amt', m.el).value || 0).toFixed(2);
          if (val < minP || val > due) return toast('Enter an amount between ' + money(minP) + ' and ' + money(due), 'error');
          m.close();
          payOrderOnline(val);
        };
      }
    });
  };
  const cancel = $('#c-cancel', el);
  if (cancel) cancel.onclick = async () => {
    if (!(await confirmBox('Cancel order <b>' + esc(o.code) + '</b>?', 'Yes, cancel', true))) return;
    busy(cancel, async () => { await api('POST', '/api/orders/' + o.id + '/cancel', {}); toast('Order cancelled'); refreshPage(); });
  };
  const ratings = {};
  $$('.star-pick', el).forEach(sp => $$('span', sp).forEach(st => st.onclick = () => {
    ratings[sp.dataset.name] = Number(st.dataset.v);
    $$('span', sp).forEach(x => x.classList.toggle('on', Number(x.dataset.v) <= ratings[sp.dataset.name]));
  }));
  const rf = $('#rate-f', el);
  if (rf) rf.onsubmit = e => {
    e.preventDefault();
    if (!ratings.rating) return toast('Please select a service rating', 'error');
    busy(e.submitter, async () => { await api('POST', '/api/orders/' + o.id + '/rate', Object.assign({ review: rf.review.value }, ratings)); toast('Thanks for your feedback!'); refreshPage(); });
  };
  $('#c-reorder', el).onclick = () => {
    NO.cart = {};
    o.items.forEach(i => { if (svcById(i.serviceId)) NO.cart[i.serviceId] = i.qty; });
    NO.coupon = ''; NO.quote = null;
    navigate('/c/new');
  };
}

/* ---------- Address modal (shared) ---------- */
function addressModal(a, onSaved) {
  a = a || {};
  modal({
    title: a.id ? 'Edit Address' : 'Add New Address',
    body: `<form id="af">
      <div class="grid2"><div class="field"><label>Label</label><input name="label" value="${esc(a.label || 'Home')}" placeholder="Home / Office"></div>
      <div class="field"><label>Area</label><select name="area">${areaOptions(a.area)}</select></div></div>
      <div class="field"><label>Full address</label><input name="line" value="${esc(a.line || '')}" placeholder="House, Road, Block, Flat" required></div>
      <div class="grid2"><div class="field"><label>Landmark</label><input name="landmark" value="${esc(a.landmark || '')}"></div>
      <div class="field"><label>Contact phone</label><input name="phone" value="${esc(a.phone || S.user.phone || '')}"></div></div>
      <label class="check"><input type="checkbox" name="isDefault" ${a.isDefault ? 'checked' : ''}> Set as default address</label>
    </form>`,
    foot: '<button class="btn ghost" data-close>Cancel</button><button class="btn" id="af-save">Save Address</button>',
    onMount: m => {
      $('#af-save', m.el).onclick = e => {
        const f = $('#af', m.el);
        if (!f.reportValidity()) return;
        busy(e.target, async () => {
          const saved = await api(a.id ? 'PUT' : 'POST', '/api/me/addresses' + (a.id ? '/' + a.id : ''), formData(f));
          m.close(); toast('Address saved'); onSaved && onSaved(saved);
        });
      };
    }
  });
}

page('/c/addresses', {
  roles: C, title: 'My Addresses',
  async render(el) {
    const list = await api('GET', '/api/me/addresses');
    el.innerHTML = `<div class="flex between mb"><p class="muted" style="margin:0">Saved addresses for faster pickups.</p><button class="btn" id="add-a">+ Add Address</button></div>
      ${list.length ? `<div class="svc-grid" style="grid-template-columns:repeat(auto-fill,minmax(280px,1fr))">${list.map(a => `<div class="card" style="margin:0">
        <div class="flex between"><b>📍 ${esc(a.label)}</b>${a.isDefault ? badge('active', 'Default') : ''}</div>
        <p style="margin:8px 0">${addrText(a)}</p><div class="small muted">📞 ${esc(a.phone || '-')}</div>
        <div class="flex mt"><button class="btn sm outline" data-edit="${a.id}">Edit</button>${a.isDefault ? '' : `<button class="btn sm ghost" data-def="${a.id}">Make default</button>`}<button class="btn sm ghost" data-del="${a.id}">🗑️</button></div></div>`).join('')}</div>`
        : `<div class="card">${emptyState('📍', 'No saved addresses yet.')}</div>`}`;
    const rerender = () => this.render(el);
    $('#add-a').onclick = () => addressModal(null, rerender);
    $$('[data-edit]', el).forEach(b => b.onclick = () => addressModal(list.find(a => a.id === b.dataset.edit), rerender));
    $$('[data-def]', el).forEach(b => b.onclick = () => busy(b, async () => { await api('PUT', '/api/me/addresses/' + b.dataset.def, { isDefault: true }); rerender(); }));
    $$('[data-del]', el).forEach(b => b.onclick = async () => {
      if (await confirmBox('Delete this address?', 'Delete', true)) busy(b, async () => { await api('DELETE', '/api/me/addresses/' + b.dataset.del); toast('Address deleted'); rerender(); });
    });
  }
});

page('/c/profile', { roles: C, title: 'My Profile', render: el => renderProfile(el) });

/* ---------- New order / schedule pickup ---------- */
page('/c/new', {
  roles: C, title: 'Schedule a Pickup',
  async render(el) {
    const addresses = await api('GET', '/api/me/addresses');
    const s = S.config.settings;
    if (!NO.date || NO.date < todayISO()) NO.date = todayISO();
    if (!NO.slot || !s.timeSlots.includes(NO.slot)) NO.slot = s.timeSlots[0];
    if (!addresses.find(a => a.id === NO.pickupAddrId)) { const d = addresses.find(a => a.isDefault) || addresses[0]; NO.pickupAddrId = d ? d.id : null; }
    const cats = ['All'].concat([...new Set(S.config.services.map(v => v.category))]);

    el.innerHTML = `<div class="cols"><div>
      <div class="card"><div class="card-h"><h3>1. Choose items</h3><span class="small muted">Tap + to add</span></div>
        <div class="tabs" id="cat-tabs">${cats.map(c => `<div class="tab ${c === NO.cat ? 'active' : ''}" data-c="${esc(c)}">${esc(c)}</div>`).join('')}</div>
        <div class="svc-grid" id="svc-grid"></div></div>

      <div class="card"><div class="card-h"><h3>2. Pickup details</h3></div>
        <label>Pickup address</label><div id="addr-box"></div>
        <div class="grid2 mt"><div class="field"><label>Pickup date</label><input type="date" id="p-date" min="${todayISO()}" value="${NO.date}"></div>
          <div class="field"><label>Express service</label><label class="check" style="padding:10px 0"><input type="checkbox" id="p-express" ${NO.express ? 'checked' : ''}> ⚡ Priority cleaning (+${s.expressSurchargePercent}%)</label></div></div>
        <label>Pickup time slot</label>
        <div class="opt-grid" id="slots">${s.timeSlots.map(t => `<div class="opt ${t === NO.slot ? 'sel' : ''}" data-slot="${esc(t)}">🕒 ${esc(t)}</div>`).join('')}</div>
        <label class="check mt"><input type="checkbox" id="same-addr" ${NO.deliverySame ? 'checked' : ''}> Deliver to the same address</label>
        <div id="deliv-box" class="${NO.deliverySame ? 'hidden' : ''} mt"></div>
        <div class="field mt"><label>Special instructions</label><textarea id="p-notes" placeholder="e.g. Use mild detergent, call before arriving, stain on white shirt…">${esc(NO.notes)}</textarea></div>
      </div>

      <div class="card"><div class="card-h"><h3>3. Payment method & plan</h3><span class="small muted">Online Prepayment or COD</span></div>
        <div class="pay-plan-grid" id="pay">
          <div class="opt ${NO.payment === 'online' ? 'sel' : ''}" data-pay="online">
            <div class="flex between"><b>💳 Full Online Payment</b><span class="badge b-paid">100% Prepaid</span></div>
            <small class="mt" style="margin-top:4px">Pay full bill now via bKash, Nagad, Rocket, Upay, Card, or Bank</small>
          </div>
          <div class="opt ${NO.payment === 'prepayment' ? 'sel' : ''}" data-pay="prepayment">
            <div class="flex between"><b>⚡ Prepayment + COD</b><span class="badge b-ready">Advance + Due</span></div>
            <small class="mt" style="margin-top:4px">Pay advance online now (${s.prepaymentMinPercent || 30}%+) & pay remaining cash on delivery</small>
          </div>
          <div class="opt ${NO.payment === 'cod' ? 'sel' : ''}" data-pay="cod">
            <div class="flex between"><b>💵 Cash on Delivery (COD)</b><span class="badge b-pending">Pay at Delivery</span></div>
            <small class="mt" style="margin-top:4px">Pay full amount in cash to the rider when clothes are delivered</small>
          </div>
        </div>

        <div id="gw-select-box" class="${NO.payment === 'cod' ? 'hidden' : ''} mt">
          <label>Select Online Payment Gateway</label>
          <div class="gw-pills" id="gw-pills">
            ${[
              ['bKash', '📱 bKash', '#e2136e'],
              ['Nagad', '🟠 Nagad', '#f7941d'],
              ['Rocket', '🟣 Rocket', '#8c3494'],
              ['Upay', '🔵 Upay', '#0054a6'],
              ['Visa/Mastercard', '💳 Card', '#1a1f71'],
              ['NetBanking', '🏦 Net Banking', '#0e7c86']
            ].map(([id, label, col]) => `<button type="button" class="gw-pill ${NO.provider === id ? 'active' : ''}" data-gw="${id}" style="--gw-col:${col}">${label}</button>`).join('')}
          </div>
        </div>

        <div id="prepay-box" class="${NO.payment === 'prepayment' ? '' : 'hidden'} mt">
          <div class="pay-summary-box">
            <label>Choose Advance Prepayment Amount</label>
            <div class="opt-grid" id="prepay-pcts" style="grid-template-columns:repeat(4,1fr);margin-bottom:10px">
              ${[30, 50, 70].map(p => `<div class="opt center ${NO.prepayPct === p && !NO.prepayCustom ? 'sel' : ''}" data-pct="${p}">${p}%<small>Advance</small></div>`).join('')}
              <div class="opt center ${NO.prepayCustom ? 'sel' : ''}" data-pct="custom">Custom<small>Amount</small></div>
            </div>
            <div id="prepay-custom-wrap" class="${NO.prepayCustom ? '' : 'hidden'} field">
              <label>Custom advance amount (${esc(cur())})</label>
              <input type="number" id="prepay-custom-in" min="1" placeholder="Enter advance amount" value="${esc(NO.prepayCustom)}">
            </div>
            <div id="prepay-split"></div>
          </div>
        </div>
      </div>
    </div>

    <div><div class="card sticky"><div class="card-h"><h3>🧾 Order Summary</h3></div>
      <div id="sum-lines"></div>
      <div class="flex mt"><input id="coupon" placeholder="Coupon code" value="${esc(NO.coupon)}" style="text-transform:uppercase"><button class="btn outline" id="apply-c">${NO.coupon ? 'Remove' : 'Apply'}</button></div>
      <div id="sum-totals" class="mt"></div>
      <button class="btn block lg mt" id="place">Place Order</button>
      <p class="small muted center">Minimum order ${money(s.minOrderAmount)} · Free pickup above ${money(s.freeDeliveryAbove)}</p>
    </div></div></div>`;

    const calcPrepayAmount = total => {
      if (!total) return 0;
      const minAdv = Math.max(1, Math.round(total * ((s.prepaymentMinPercent || 30) / 100)));
      if (NO.prepayCustom) {
        const v = Number(NO.prepayCustom);
        return Number.isFinite(v) ? Math.min(total, Math.max(minAdv, Math.round(v))) : minAdv;
      }
      return Math.min(total, Math.max(minAdv, Math.round(total * (NO.prepayPct || 50) / 100)));
    };

    const renderPaymentBreakdown = () => {
      const q = NO.quote;
      const total = q ? q.total : 0;
      const adv = NO.payment === 'online' ? total : NO.payment === 'prepayment' ? calcPrepayAmount(total) : 0;
      const due = Math.max(0, +(total - adv).toFixed(2));
      const minAdv = Math.max(1, Math.round(total * ((s.prepaymentMinPercent || 30) / 100)));
      if ($('#prepay-split')) {
        $('#prepay-split').innerHTML = total ? `
          <div class="sum-row" style="color:var(--ok)"><span>Pay Online Now (${esc(NO.provider)})</span><b>${money(adv)}</b></div>
          <div class="sum-row" style="color:var(--err)"><span>Due on Delivery (COD)</span><b>${money(due)}</b></div>
          <div class="small muted">Minimum advance (${s.prepaymentMinPercent || 30}%): ${money(minAdv)}</div>
        ` : '<div class="small muted">Add items above to calculate advance & COD split.</div>';
      }
      if ($('#sum-totals') && q) {
        $('#sum-totals').innerHTML = `<div class="sum-row"><span>Subtotal</span><span>${money(q.subtotal)}</span></div>
          ${q.expressFee ? `<div class="sum-row"><span>⚡ Express</span><span>${money(q.expressFee)}</span></div>` : ''}
          <div class="sum-row"><span>Pickup & Delivery</span><span>${q.deliveryFee ? money(q.deliveryFee) : '<b style="color:var(--ok)">FREE</b>'}</span></div>
          ${q.discount ? `<div class="sum-row" style="color:var(--ok)"><span>Discount (${esc(NO.coupon)})</span><span>−${money(q.discount)}</span></div>` : ''}
          <div class="sum-row total"><span>Total Bill</span><span>${money(q.total)}</span></div>
          <div class="pay-summary-box mt" style="padding:10px 12px">
            <div class="sum-row" style="color:var(--ok)"><span>💳 Pay Online Now</span><b>${money(adv)}</b></div>
            <div class="sum-row" style="color:${due > 0 ? 'var(--accent)' : 'var(--muted)'}"><span>💵 Due at Delivery (COD)</span><b>${money(due)}</b></div>
          </div>`;
      }
      const btn = $('#place');
      if (btn) {
        if (NO.payment === 'online') btn.innerHTML = total ? `💳 Pay ${money(total)} via ${esc(NO.provider)} & Place Order` : '💳 Pay Online & Place Order';
        else if (NO.payment === 'prepayment') btn.innerHTML = total ? `⚡ Pay ${money(adv)} Advance & Place Order` : '⚡ Pay Advance & Place Order';
        else btn.innerHTML = total ? `💵 Place Order (COD ${money(total)})` : '💵 Place Order (Cash on Delivery)';
      }
    };

    const renderGrid = () => {
      const list = S.config.services.filter(v => NO.cat === 'All' || v.category === NO.cat);
      $('#svc-grid').innerHTML = list.map(v => {
        const q = NO.cart[v.id] || 0;
        return `<div class="svc ${q ? 'sel' : ''}" data-sid="${v.id}"><div class="flex between"><span class="si">${esc(v.icon)}</span><span class="badge">${esc(v.category)}</span></div>
          <div class="sn">${esc(v.name)}</div><div class="sp">${money(v.price)} <span class="muted small">/ ${esc(v.unit)}</span></div>
          <div class="stepper"><button type="button" data-op="-">−</button><span>${q}</span><button type="button" data-op="+">+</button></div></div>`;
      }).join('');
    };
    const renderAddr = () => {
      const card = (a, key) => `<div class="addr-card ${NO[key] === a.id ? 'sel' : ''}" data-aid="${a.id}" data-key="${key}"><b>${esc(a.label)}</b>${a.isDefault ? ' <span class="small muted">(default)</span>' : ''}<div class="small">${addrText(a)}</div></div>`;
      const box = key => `<div class="svc-grid" style="grid-template-columns:repeat(auto-fill,minmax(220px,1fr))">${addresses.map(a => card(a, key)).join('')}
        <div class="addr-card center" data-new="${key}" style="display:grid;place-items:center;color:var(--primary);font-weight:600">+ Add new address</div></div>`;
      $('#addr-box').innerHTML = box('pickupAddrId');
      $('#deliv-box').innerHTML = '<label>Delivery address</label>' + box('deliveryAddrId');
      $$('[data-aid]', el).forEach(c => c.onclick = () => { NO[c.dataset.key] = c.dataset.aid; renderAddr(); });
      $$('[data-new]', el).forEach(c => c.onclick = () => addressModal(null, a => { addresses.push(a); NO[c.dataset.new] = a.id; renderAddr(); }));
    };

    let qt = null;
    const updateSummary = () => {
      const lines = Object.keys(NO.cart).filter(id => NO.cart[id] > 0 && svcById(id)).map(id => ({ v: svcById(id), q: NO.cart[id] }));
      $('#sum-lines').innerHTML = lines.length
        ? lines.map(l => `<div class="sum-row"><span>${esc(l.v.icon)} ${esc(l.v.name)} <span class="muted">× ${l.q}</span></span><span>${money(l.v.price * l.q)}</span></div>`).join('')
        : '<div class="muted small center" style="padding:14px 0">Your basket is empty</div>';
      clearTimeout(qt);
      if (!lines.length) { NO.quote = null; $('#sum-totals').innerHTML = ''; renderPaymentBreakdown(); return; }
      qt = setTimeout(async () => {
        const body = { items: lines.map(l => ({ serviceId: l.v.id, qty: l.q })), express: NO.express, couponCode: NO.coupon || null };
        try { NO.quote = await api('POST', '/api/orders/quote', body); }
        catch (e) {
          if (NO.coupon) { toast(e.message, 'error'); NO.coupon = ''; $('#coupon').value = ''; $('#apply-c').textContent = 'Apply'; return updateSummary(); }
          return toast(e.message, 'error');
        }
        if (!$('#sum-totals')) return;
        renderPaymentBreakdown();
      }, 250);
    };

    $('#svc-grid').onclick = e => {
      const b = e.target.closest('[data-op]');
      if (!b) return;
      const card = b.closest('[data-sid]'), v = svcById(card.dataset.sid);
      const step = v.unit === 'kg' ? 0.5 : 1;
      let q = (NO.cart[v.id] || 0) + (b.dataset.op === '+' ? step : -step);
      q = Math.max(0, Math.round(q * 10) / 10);
      NO.cart[v.id] = q;
      $('span', card.querySelector('.stepper')).textContent = q;
      card.classList.toggle('sel', q > 0);
      updateSummary();
    };
    $$('#cat-tabs .tab', el).forEach(t => t.onclick = () => { NO.cat = t.dataset.c; $$('#cat-tabs .tab', el).forEach(x => x.classList.toggle('active', x === t)); renderGrid(); });
    $$('#slots .opt', el).forEach(o => o.onclick = () => { NO.slot = o.dataset.slot; $$('#slots .opt', el).forEach(x => x.classList.toggle('sel', x === o)); });
    $$('#pay .opt', el).forEach(o => o.onclick = () => {
      NO.payment = o.dataset.pay;
      $$('#pay .opt', el).forEach(x => x.classList.toggle('sel', x === o));
      $('#gw-select-box').classList.toggle('hidden', NO.payment === 'cod');
      $('#prepay-box').classList.toggle('hidden', NO.payment !== 'prepayment');
      renderPaymentBreakdown();
    });
    $$('#gw-pills .gw-pill', el).forEach(b => b.onclick = () => {
      NO.provider = b.dataset.gw;
      $$('#gw-pills .gw-pill', el).forEach(x => x.classList.toggle('active', x === b));
      renderPaymentBreakdown();
    });
    $$('#prepay-pcts .opt', el).forEach(b => b.onclick = () => {
      $$('#prepay-pcts .opt', el).forEach(x => x.classList.toggle('sel', x === b));
      if (b.dataset.pct === 'custom') {
        const total = NO.quote ? NO.quote.total : 0;
        NO.prepayCustom = String(calcPrepayAmount(total) || 100);
        $('#prepay-custom-in').value = NO.prepayCustom;
        $('#prepay-custom-wrap').classList.remove('hidden');
      } else {
        NO.prepayPct = Number(b.dataset.pct);
        NO.prepayCustom = '';
        $('#prepay-custom-wrap').classList.add('hidden');
      }
      renderPaymentBreakdown();
    });
    $('#prepay-custom-in').oninput = e => {
      NO.prepayCustom = e.target.value;
      renderPaymentBreakdown();
    };
    $('#p-date').onchange = e => { NO.date = e.target.value; };
    $('#p-notes').oninput = e => { NO.notes = e.target.value; };
    $('#p-express').onchange = e => { NO.express = e.target.checked; updateSummary(); };
    $('#same-addr').onchange = e => { NO.deliverySame = e.target.checked; $('#deliv-box').classList.toggle('hidden', NO.deliverySame); };
    $('#apply-c').onclick = () => {
      if (NO.coupon) { NO.coupon = ''; $('#coupon').value = ''; $('#apply-c').textContent = 'Apply'; return updateSummary(); }
      const code = $('#coupon').value.trim().toUpperCase();
      if (!code) return toast('Enter a coupon code', 'error');
      if (!Object.values(NO.cart).some(q => q > 0)) return toast('Add items first', 'error');
      NO.coupon = code; $('#apply-c').textContent = 'Remove'; updateSummary();
      setTimeout(() => { if (NO.coupon) toast('Coupon ' + code + ' applied 🎉'); }, 700);
    };

    $('#place').onclick = () => {
      const items = Object.keys(NO.cart).filter(id => NO.cart[id] > 0 && svcById(id)).map(id => ({ serviceId: Number(id), qty: NO.cart[id] }));
      if (!items.length) return toast('Please add at least one item', 'error');
      const pa = addresses.find(a => a.id === NO.pickupAddrId);
      if (!pa) return toast('Please select or add a pickup address', 'error');
      let da = pa;
      if (!NO.deliverySame) { da = addresses.find(a => a.id === NO.deliveryAddrId); if (!da) return toast('Please select a delivery address', 'error'); }
      if (!NO.date) return toast('Please choose a pickup date', 'error');
      if (NO.quote && NO.quote.subtotal < s.minOrderAmount) return toast('Minimum order amount is ' + money(s.minOrderAmount), 'error');
      const total = NO.quote ? NO.quote.total : 0;
      const prepaidAmount = NO.payment === 'online' ? total : NO.payment === 'prepayment' ? calcPrepayAmount(total) : 0;
      const body = {
        items, express: NO.express, couponCode: NO.coupon || null,
        pickupAddress: pa, deliveryAddress: da, pickupDate: NO.date, pickupSlot: NO.slot,
        notes: NO.notes, paymentMethod: NO.payment, prepaidAmount
      };
      const submit = async payRes => {
        if (payRes) {
          body.paymentProvider = payRes.provider;
          body.paymentAccount = payRes.account;
          body.transactionId = payRes.transactionId;
        }
        const o = await api('POST', '/api/orders', body);
        Object.assign(NO, { cart: {}, coupon: '', notes: '', express: false, quote: null, prepayCustom: '' });
        toast('🎉 Order ' + o.code + ' placed successfully!');
        navigate('/c/order/' + o.id);
      };
      if (NO.payment === 'online' || NO.payment === 'prepayment') {
        const payNow = NO.payment === 'online' ? total : prepaidAmount;
        const dueLater = Math.max(0, +(total - payNow).toFixed(2));
        paymentModal(payNow, {
          provider: NO.provider,
          totalBill: total,
          dueLater,
          label: NO.payment === 'prepayment' ? `Advance Prepayment (Due on Delivery: ${money(dueLater)})` : 'Full Online Prepayment (100%)'
        }, submit);
      } else {
        busy($('#place'), () => submit(null));
      }
    };

    renderGrid(); renderAddr(); updateSummary();
  }
});

/** Interactive Online Payment Gateway Modal (bKash, Nagad, Rocket, Upay, Visa/Mastercard, Net Banking). */
const GATEWAYS = {
  bKash: { name: 'bKash', type: 'mfs', color: '#e2136e', icon: '📱', prefix: 'BKX', pinLen: 5 },
  Nagad: { name: 'Nagad', type: 'mfs', color: '#f7941d', icon: '🟠', prefix: 'NGD', pinLen: 4 },
  Rocket: { name: 'Rocket', type: 'mfs', color: '#8c3494', icon: '🟣', prefix: 'RKT', pinLen: 4 },
  Upay: { name: 'Upay', type: 'mfs', color: '#0054a6', icon: '🔵', prefix: 'UPY', pinLen: 4 },
  'Visa/Mastercard': { name: 'Visa / Mastercard', type: 'card', color: '#1a1f71', icon: '💳', prefix: 'CRD' },
  NetBanking: { name: 'Internet Banking', type: 'bank', color: '#0e7c86', icon: '🏦', prefix: 'BNK' }
};

function paymentModal(amount, opts, onPaid) {
  if (typeof opts === 'function') { onPaid = opts; opts = {}; }
  opts = opts || {};
  let curGw = GATEWAYS[opts.provider] ? opts.provider : 'bKash';

  modal({
    title: '🔒 FreshFold Secure Payment Gateway',
    wide: false,
    body: `
      <div class="gw-banner" id="gw-banner"></div>
      <div class="gw-pills mb" id="modal-gw-tabs">
        ${Object.keys(GATEWAYS).map(k => {
          const g = GATEWAYS[k];
          return `<button type="button" class="gw-pill ${k === curGw ? 'active' : ''}" data-gw="${k}" style="--gw-col:${g.color}">${g.icon} ${esc(k === 'Visa/Mastercard' ? 'Card' : k)}</button>`;
        }).join('')}
      </div>
      <form id="payf">
        <div id="pm-mfs">
          <div class="field"><label id="mfs-lbl">Wallet Account Number</label>
            <input id="mfs-phone" value="${esc(S.user.phone || '01711111111')}" placeholder="01XXXXXXXXX" required></div>
          <div class="grid2">
            <div class="field"><label>OTP Verification Code <span class="muted">(demo: 1234)</span></label>
              <input id="mfs-otp" value="1234" maxlength="6" required></div>
            <div class="field"><label>Wallet PIN</label>
              <input id="mfs-pin" type="password" value="12345" required></div>
          </div>
        </div>
        <div id="pm-card" class="hidden">
          <div class="field"><label>Cardholder Name</label><input id="crd-name" value="${esc(S.user.name || 'Demo Customer')}" required></div>
          <div class="field"><label>Card Number</label><input id="crd-num" value="4242 4242 4242 4242" maxlength="19" required></div>
          <div class="grid2">
            <div class="field"><label>Expiry (MM/YY)</label><input id="crd-exp" value="12/29" required></div>
            <div class="field"><label>CVV / CVC</label><input id="crd-cvc" type="password" value="123" maxlength="4" required></div>
          </div>
        </div>
        <div id="pm-bank" class="hidden">
          <div class="field"><label>Select Bank</label>
            <select id="bnk-name">
              <option>City Bank (Citytouch)</option>
              <option>BRAC Bank (Astha)</option>
              <option>Dutch-Bangla Bank (NexusPay)</option>
              <option>Islami Bank (CellFin)</option>
              <option>Eastern Bank (EBL Skybanking)</option>
            </select></div>
          <div class="grid2">
            <div class="field"><label>Account / User ID</label><input id="bnk-acc" value="${esc(S.user.phone || '1029384756')}" required></div>
            <div class="field"><label>One-Time Password (OTP)</label><input id="bnk-otp" type="password" value="123456" required></div>
          </div>
        </div>
      </form>
      <div class="pay-summary-box">
        ${opts.label ? `<div class="small muted mb" style="margin-bottom:6px">${esc(opts.label)}</div>` : ''}
        <div class="sum-row total" style="margin-top:0;padding-top:0;border-top:none"><span>Payable Now</span><span id="gw-amt">${money(amount)}</span></div>
        ${opts.dueLater ? `<div class="sum-row small" style="color:var(--accent)"><span>Remaining Due on Delivery (COD)</span><b>${money(opts.dueLater)}</b></div>` : ''}
      </div>`,
    foot: `<button class="btn ghost" data-close>Cancel</button><button class="btn success lg" id="pay-now">🔒 Confirm & Pay ${money(amount)}</button>`,
    onMount: m => {
      const syncGw = () => {
        const g = GATEWAYS[curGw];
        $('#gw-banner', m.el).style.background = g.color;
        $('#gw-banner', m.el).innerHTML = `<div class="flex between"><div><div style="font-size:18px;font-weight:800">${g.icon} ${esc(g.name)} Payment</div><div class="small" style="opacity:.9">Merchant: ${esc(S.config.settings.businessName)}</div></div><div style="font-size:22px;font-weight:800">${money(amount)}</div></div>`;
        $('#pm-mfs', m.el).classList.toggle('hidden', g.type !== 'mfs');
        $('#pm-card', m.el).classList.toggle('hidden', g.type !== 'card');
        $('#pm-bank', m.el).classList.toggle('hidden', g.type !== 'bank');
        if (g.type === 'mfs') $('#mfs-lbl', m.el).textContent = g.name + ' Wallet Number';
        $('#pay-now', m.el).style.background = g.color;
        $('#pay-now', m.el).textContent = `🔒 Pay ${money(amount)} with ${g.name}`;
      };
      $$('#modal-gw-tabs .gw-pill', m.el).forEach(b => b.onclick = () => {
        curGw = b.dataset.gw;
        $$('#modal-gw-tabs .gw-pill', m.el).forEach(x => x.classList.toggle('active', x === b));
        syncGw();
      });
      syncGw();

      $('#pay-now', m.el).onclick = e => busy(e.target, async () => {
        const g = GATEWAYS[curGw];
        let acc = '';
        if (g.type === 'mfs') {
          const ph = $('#mfs-phone', m.el).value.trim();
          if (ph.length < 8) throw new Error('Please enter a valid wallet number');
          acc = ph.slice(0, 3) + '••••' + ph.slice(-4);
        } else if (g.type === 'card') {
          const cn = $('#crd-num', m.el).value.replace(/\s+/g, '');
          if (cn.length < 12) throw new Error('Please enter a valid card number');
          acc = '•••• ' + cn.slice(-4);
        } else {
          const bn = $('#bnk-name', m.el).value.split(' ')[0];
          const ba = $('#bnk-acc', m.el).value.trim();
          acc = bn + ' •••' + ba.slice(-3);
        }
        await new Promise(r => setTimeout(r, 700));
        const txn = g.prefix + Date.now().toString(36).toUpperCase() + Math.floor(100 + Math.random() * 900);
        await onPaid({ provider: curGw, account: acc, transactionId: txn, amount });
        m.close();
      });
    }
  });
}

