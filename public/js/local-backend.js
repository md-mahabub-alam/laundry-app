'use strict';
/* =========================================================
   FreshFold Laundry — Embedded Browser Backend (localStorage)
   Automatically powers the app when opened directly in a browser
   (file:// or static server) without needing a Node.js terminal.
   ========================================================= */
(function () {
  const STORAGE_KEY = 'ff_local_db_v1';

  const now = () => new Date().toISOString();
  const hashPassword = pw => 'plain:' + String(pw);
  const verifyPassword = (pw, stored) => {
    if (!stored) return false;
    if (stored.startsWith('plain:')) return stored === 'plain:' + String(pw);
    return String(pw) === stored;
  };

  function seed() {
    const t = now();
    const d = {
      counters: { user: 3, service: 0, order: 1000, coupon: 0, notification: 0, earning: 0 },
      settings: {
        businessName: 'FreshFold Laundry',
        currency: '৳',
        supportPhone: '+880 1700-000000',
        supportEmail: 'support@freshfold.com',
        deliveryFee: 60,
        freeDeliveryAbove: 1500,
        expressSurchargePercent: 50,
        minOrderAmount: 200,
        riderFeePerTask: 50,
        prepaymentMinPercent: 30,
        timeSlots: ['09:00 - 11:00', '11:00 - 13:00', '14:00 - 16:00', '16:00 - 18:00', '18:00 - 20:00'],
        serviceAreas: ['Dhanmondi', 'Gulshan', 'Banani', 'Mirpur', 'Uttara', 'Mohammadpur', 'Bashundhara', 'Motijheel']
      },
      users: [
        { id: 1, role: 'admin', name: 'System Admin', email: 'admin@freshfold.com', phone: '01700000000', password: hashPassword('admin123'), status: 'active', createdAt: t },
        { id: 2, role: 'customer', name: 'Demo Customer', email: 'customer@demo.com', phone: '01711111111', password: hashPassword('123456'), status: 'active', createdAt: t,
          addresses: [{ id: 'a1', label: 'Home', line: 'House 12, Road 5', area: 'Dhanmondi', landmark: 'Near Lake', phone: '01711111111', isDefault: true }] },
        { id: 3, role: 'rider', name: 'Demo Rider', email: 'rider@demo.com', phone: '01722222222', password: hashPassword('123456'), status: 'active', approved: true,
          vehicle: 'Motorbike', vehicleNumber: 'DHAKA-METRO-HA-12-3456', area: 'Dhanmondi', nid: '1990123456789', available: true, createdAt: t }
      ],
      services: [],
      coupons: [],
      orders: [],
      notifications: [],
      earnings: []
    };
    const svc = [
      ['Shirt / T-Shirt', 'Wash & Iron', 'piece', 40, '👕'],
      ['Pant / Trouser', 'Wash & Iron', 'piece', 50, '👖'],
      ['Panjabi', 'Wash & Iron', 'piece', 70, '🥻'],
      ['Wash & Fold (Mixed)', 'Wash & Fold', 'kg', 90, '🧺'],
      ['Bed Sheet', 'Wash & Iron', 'piece', 80, '🛏️'],
      ['Blanket / Comforter', 'Wash & Fold', 'piece', 300, '🛌'],
      ['Curtain (per panel)', 'Wash & Iron', 'piece', 120, '🪟'],
      ['Saree', 'Dry Cleaning', 'piece', 250, '🥻'],
      ['Suit (2 pcs)', 'Dry Cleaning', 'piece', 400, '🤵'],
      ['Blazer / Coat', 'Dry Cleaning', 'piece', 300, '🧥'],
      ['Shirt Ironing', 'Iron Only', 'piece', 15, '♨️'],
      ['Pant Ironing', 'Iron Only', 'piece', 20, '♨️'],
      ['Sneakers / Shoes', 'Shoe Care', 'pair', 250, '👟']
    ];
    svc.forEach(([name, category, unit, price, icon]) => {
      d.counters.service++;
      d.services.push({ id: d.counters.service, name, category, unit, price, icon, description: category + ' service', active: true, createdAt: t });
    });
    d.counters.coupon++;
    d.coupons.push({ id: d.counters.coupon, code: 'WELCOME20', type: 'percent', value: 20, minOrder: 300, maxDiscount: 200, active: true, expiresAt: '2030-12-31', usedCount: 0, createdAt: t });
    d.counters.coupon++;
    d.coupons.push({ id: d.counters.coupon, code: 'FLAT50', type: 'flat', value: 50, minOrder: 500, maxDiscount: 0, active: true, expiresAt: '2030-12-31', usedCount: 0, createdAt: t });
    return d;
  }

  let data = null;
  function D() {
    if (!data) {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        data = raw ? JSON.parse(raw) : seed();
      } catch (e) {
        data = seed();
      }
      save();
    }
    return data;
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
  }
  function nextId(name) {
    const d = D();
    d.counters[name] = (d.counters[name] || 0) + 1;
    return d.counters[name];
  }

  class ApiError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
  const fail = (status, msg) => { throw new ApiError(status, msg); };

  function signToken(user) {
    const payload = btoa(JSON.stringify({ id: user.id, role: user.role, exp: Date.now() + 7 * 864e5 }));
    return payload + '.local';
  }
  function readToken(token) {
    if (!token || token.indexOf('.') === -1) return null;
    const [payload] = token.split('.');
    try {
      const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
      const p = JSON.parse(atob(b64));
      if (p.exp && p.exp < Date.now()) return null;
      return p;
    } catch (e) { return null; }
  }

  function publicUser(u) {
    if (!u) return null;
    const copy = Object.assign({}, u);
    delete copy.password;
    return copy;
  }
  function riderBrief(id) {
    const u = D().users.find(x => x.id === id);
    return u ? { id: u.id, name: u.name, phone: u.phone, vehicle: u.vehicle, vehicleNumber: u.vehicleNumber } : null;
  }
  function customerBrief(id) {
    const u = D().users.find(x => x.id === id);
    return u ? { id: u.id, name: u.name, phone: u.phone, email: u.email } : null;
  }
  function notify(userId, title, message, orderId) {
    D().notifications.push({ id: nextId('notification'), userId, title, message, orderId: orderId || null, read: false, createdAt: now() });
  }
  function notifyAdmins(title, message, orderId) {
    D().users.filter(u => u.role === 'admin').forEach(a => notify(a.id, title, message, orderId));
  }
  const num = (v, def) => { const n = Number(v); return Number.isFinite(n) ? n : def; };
  const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max || 500);
  const isEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  const localDay = d => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };

  const STATUS_LABEL = {
    pending: 'Order Placed', pickup_assigned: 'Rider Assigned for Pickup', picked_up: 'Picked Up',
    at_laundry: 'Received at Laundry', processing: 'Cleaning in Progress', ready: 'Ready for Delivery',
    delivery_assigned: 'Rider Assigned for Delivery', out_for_delivery: 'Out for Delivery',
    delivered: 'Delivered', cancelled: 'Cancelled'
  };

  function setStatus(order, status, by, note) {
    order.status = status;
    order.updatedAt = now();
    order.timeline.push({ status, label: STATUS_LABEL[status], at: now(), by, note: note || '' });
    notify(order.customerId, 'Order ' + order.code, 'Status: ' + STATUS_LABEL[status] + (note ? ' - ' + note : ''), order.id);
  }

  function syncOrderPayment(o) {
    if (!Array.isArray(o.payments)) o.payments = [];
    if (o.paidAmount === undefined) {
      o.paidAmount = o.paymentStatus === 'paid' ? o.total : 0;
    }
    o.paidAmount = +Math.min(o.total, Math.max(0, Number(o.paidAmount) || 0)).toFixed(2);
    o.dueAmount = +Math.max(0, o.total - o.paidAmount).toFixed(2);
    if (!o.paymentProvider) {
      o.paymentProvider = o.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online Gateway';
    }
    return o;
  }

  function enrichOrder(o, role) {
    syncOrderPayment(o);
    const out = Object.assign({}, o, {
      statusLabel: STATUS_LABEL[o.status],
      pickupRider: riderBrief(o.pickupRiderId),
      deliveryRider: riderBrief(o.deliveryRiderId)
    });
    if (role !== 'customer') out.customer = customerBrief(o.customerId);
    return out;
  }

  function computeCart(items, express, couponCode) {
    const s = D().settings;
    if (!Array.isArray(items) || !items.length) fail(400, 'Please add at least one item');
    const lines = items.map(it => {
      const svc = D().services.find(x => x.id === Number(it.serviceId) && x.active);
      if (!svc) fail(400, 'Invalid service selected');
      const qty = Math.max(0, Math.min(500, num(it.qty, 0)));
      if (!qty) fail(400, 'Quantity must be greater than 0 for ' + svc.name);
      return { serviceId: svc.id, name: svc.name, category: svc.category, unit: svc.unit, icon: svc.icon, price: svc.price, qty, total: +(svc.price * qty).toFixed(2) };
    });
    const subtotal = +lines.reduce((a, l) => a + l.total, 0).toFixed(2);
    const expressFee = express ? +(subtotal * s.expressSurchargePercent / 100).toFixed(2) : 0;
    let discount = 0, coupon = null;
    if (couponCode) {
      coupon = D().coupons.find(c => c.code.toUpperCase() === String(couponCode).toUpperCase().trim());
      if (!coupon || !coupon.active) fail(400, 'Invalid coupon code');
      if (coupon.expiresAt && new Date(coupon.expiresAt + 'T23:59:59') < new Date()) fail(400, 'Coupon has expired');
      if (subtotal < (coupon.minOrder || 0)) fail(400, 'Minimum order for this coupon is ' + s.currency + coupon.minOrder);
      discount = coupon.type === 'percent' ? subtotal * coupon.value / 100 : coupon.value;
      if (coupon.maxDiscount > 0) discount = Math.min(discount, coupon.maxDiscount);
      discount = +Math.min(discount, subtotal).toFixed(2);
    }
    const deliveryFee = s.freeDeliveryAbove > 0 && subtotal >= s.freeDeliveryAbove ? 0 : s.deliveryFee;
    const total = +(subtotal + expressFee + deliveryFee - discount).toFixed(2);
    return { lines, subtotal, expressFee, discount, deliveryFee, total, coupon };
  }

  function cleanAddress(a) {
    if (!a || !str(a.line) || !str(a.area)) fail(400, 'Address (line & area) is required');
    return { label: str(a.label, 40) || 'Address', line: str(a.line, 200), area: str(a.area, 80), landmark: str(a.landmark, 120), phone: str(a.phone, 20) };
  }

  const routes = [];
  function route(method, pattern, roles, handler) {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
    routes.push({ method, re, keys, roles, handler });
  }

  route('GET', '/api/public/config', null, () => {
    const s = D().settings;
    return {
      settings: s,
      services: D().services.filter(x => x.active),
      statusLabels: STATUS_LABEL,
      stats: { customers: D().users.filter(u => u.role === 'customer').length, delivered: D().orders.filter(o => o.status === 'delivered').length }
    };
  });

  route('POST', '/api/auth/register', null, ({ body }) => {
    const role = body.role === 'rider' ? 'rider' : 'customer';
    const name = str(body.name, 80), email = str(body.email, 120).toLowerCase(), phone = str(body.phone, 20);
    if (!name || !isEmail(email) || !phone) fail(400, 'Name, valid email and phone are required');
    if (String(body.password || '').length < 6) fail(400, 'Password must be at least 6 characters');
    if (D().users.some(u => u.email === email)) fail(409, 'An account with this email already exists');
    const user = { id: nextId('user'), role, name, email, phone, password: hashPassword(body.password), status: 'active', createdAt: now() };
    if (role === 'customer') {
      user.addresses = [];
      if (body.address && body.address.line) user.addresses.push(Object.assign(cleanAddress(body.address), { id: 'a' + Date.now(), isDefault: true }));
    } else {
      if (!str(body.vehicle) || !str(body.area)) fail(400, 'Vehicle type and preferred area are required for riders');
      Object.assign(user, { approved: false, available: false, vehicle: str(body.vehicle, 40), vehicleNumber: str(body.vehicleNumber, 40), area: str(body.area, 80), nid: str(body.nid, 30) });
      notifyAdmins('New rider registration', name + ' applied as a rider. Please review.', null);
    }
    D().users.push(user);
    save();
    return { token: signToken(user), user: publicUser(user) };
  });

  route('POST', '/api/auth/login', null, ({ body }) => {
    const email = str(body.email).toLowerCase();
    const user = D().users.find(u => u.email === email);
    if (!user || !verifyPassword(body.password || '', user.password)) fail(401, 'Invalid email or password');
    if (user.status === 'blocked') fail(403, 'Your account has been blocked. Contact support.');
    return { token: signToken(user), user: publicUser(user) };
  });

  route('GET', '/api/me', ['customer', 'rider', 'admin'], ({ user }) => publicUser(user));

  route('PUT', '/api/me', ['customer', 'rider', 'admin'], ({ user, body }) => {
    if (body.name !== undefined) { const n = str(body.name, 80); if (!n) fail(400, 'Name required'); user.name = n; }
    if (body.phone !== undefined) user.phone = str(body.phone, 20);
    if (body.email !== undefined) {
      const e = str(body.email, 120).toLowerCase();
      if (!isEmail(e)) fail(400, 'Invalid email');
      if (D().users.some(u => u.email === e && u.id !== user.id)) fail(409, 'Email already in use');
      user.email = e;
    }
    if (user.role === 'rider') {
      ['vehicle', 'vehicleNumber', 'area', 'nid'].forEach(k => { if (body[k] !== undefined) user[k] = str(body[k], 80); });
    }
    save();
    return publicUser(user);
  });

  route('PUT', '/api/me/password', ['customer', 'rider', 'admin'], ({ user, body }) => {
    if (!verifyPassword(body.currentPassword || '', user.password)) fail(400, 'Current password is incorrect');
    if (String(body.newPassword || '').length < 6) fail(400, 'New password must be at least 6 characters');
    user.password = hashPassword(body.newPassword);
    save();
    return { ok: true };
  });

  route('GET', '/api/me/addresses', ['customer'], ({ user }) => user.addresses || []);
  route('POST', '/api/me/addresses', ['customer'], ({ user, body }) => {
    user.addresses = user.addresses || [];
    const a = Object.assign(cleanAddress(body), { id: 'a' + Date.now() + Math.floor(Math.random() * 1000), isDefault: !!body.isDefault || !user.addresses.length });
    if (a.isDefault) user.addresses.forEach(x => { x.isDefault = false; });
    user.addresses.push(a);
    save();
    return a;
  });
  route('PUT', '/api/me/addresses/:aid', ['customer'], ({ user, params, body }) => {
    const a = (user.addresses || []).find(x => x.id === params.aid);
    if (!a) fail(404, 'Address not found');
    Object.assign(a, cleanAddress(Object.assign({}, a, body)));
    if (body.isDefault) { user.addresses.forEach(x => { x.isDefault = false; }); a.isDefault = true; }
    save();
    return a;
  });
  route('DELETE', '/api/me/addresses/:aid', ['customer'], ({ user, params }) => {
    user.addresses = (user.addresses || []).filter(x => x.id !== params.aid);
    if (user.addresses.length && !user.addresses.some(x => x.isDefault)) user.addresses[0].isDefault = true;
    save();
    return { ok: true };
  });

  route('GET', '/api/notifications', ['customer', 'rider', 'admin'], ({ user }) =>
    D().notifications.filter(n => n.userId === user.id).slice(-50).reverse());
  route('POST', '/api/notifications/read', ['customer', 'rider', 'admin'], ({ user }) => {
    D().notifications.forEach(n => { if (n.userId === user.id) n.read = true; });
    save();
    return { ok: true };
  });

  route('POST', '/api/coupons/validate', ['customer'], ({ body }) => {
    const c = computeCart(body.items, !!body.express, body.code);
    return { discount: c.discount, total: c.total, code: c.coupon && c.coupon.code };
  });

  route('POST', '/api/orders/quote', ['customer'], ({ body }) => {
    const c = computeCart(body.items, !!body.express, body.couponCode || null);
    return { subtotal: c.subtotal, expressFee: c.expressFee, discount: c.discount, deliveryFee: c.deliveryFee, total: c.total };
  });

  route('POST', '/api/orders', ['customer'], ({ user, body }) => {
    const s = D().settings;
    const c = computeCart(body.items, !!body.express, body.couponCode || null);
    if (c.subtotal < s.minOrderAmount) fail(400, 'Minimum order amount is ' + s.currency + s.minOrderAmount);
    const pickupAddress = cleanAddress(body.pickupAddress);
    const deliveryAddress = body.deliveryAddress && body.deliveryAddress.line ? cleanAddress(body.deliveryAddress) : pickupAddress;
    const pickupDate = str(body.pickupDate, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(pickupDate)) fail(400, 'Pickup date is required');
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (new Date(pickupDate + 'T00:00:00') < today) fail(400, 'Pickup date cannot be in the past');
    if (!s.timeSlots.includes(body.pickupSlot)) fail(400, 'Please choose a valid pickup time slot');
    const paymentMethod = ['online', 'prepayment', 'cod'].includes(body.paymentMethod) ? body.paymentMethod : 'cod';
    const provider = str(body.paymentProvider, 40) || (paymentMethod === 'cod' ? 'Cash on Delivery' : 'bKash');
    const account = str(body.paymentAccount, 40) || '';
    const id = nextId('order');
    const order = {
      id, code: 'FF-' + id, customerId: user.id, items: c.lines,
      subtotal: c.subtotal, expressFee: c.expressFee, discount: c.discount, deliveryFee: c.deliveryFee, total: c.total,
      couponCode: c.coupon ? c.coupon.code : null, express: !!body.express,
      pickupAddress, deliveryAddress, pickupDate, pickupSlot: body.pickupSlot, notes: str(body.notes, 500),
      paymentMethod, paymentProvider: provider, paymentStatus: 'unpaid',
      paidAmount: 0, dueAmount: c.total, transactionId: null, payments: [],
      status: 'pending', pickupRiderId: null, deliveryRiderId: null, rating: null, review: '', riderRating: null,
      timeline: [], createdAt: now(), updatedAt: now()
    };
    const makeTxn = p => str(body.transactionId, 40) || ((p || 'TXN').slice(0, 3).toUpperCase() + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 65535).toString(16).toUpperCase());
    if (paymentMethod === 'online') {
      const txn = makeTxn(provider);
      order.paidAmount = c.total;
      order.dueAmount = 0;
      order.paymentStatus = 'paid';
      order.transactionId = txn;
      order.payments.push({ id: 'PAY-' + Date.now(), amount: c.total, method: 'online', provider, account, transactionId: txn, note: 'Full Online Prepayment', at: now() });
    } else if (paymentMethod === 'prepayment') {
      const minAdv = Math.max(1, Math.round(c.total * ((s.prepaymentMinPercent || 30) / 100)));
      let adv = +num(body.prepaidAmount, minAdv).toFixed(2);
      if (adv < minAdv) fail(400, 'Minimum advance prepayment is ' + s.currency + minAdv);
      if (adv > c.total) adv = c.total;
      const txn = makeTxn(provider);
      order.paidAmount = adv;
      order.dueAmount = +(c.total - adv).toFixed(2);
      order.paymentStatus = order.dueAmount <= 0 ? 'paid' : 'partial';
      order.transactionId = txn;
      order.payments.push({ id: 'PAY-' + Date.now(), amount: adv, method: 'online', provider, account, transactionId: txn, note: order.dueAmount > 0 ? 'Advance Prepayment (Due on Delivery: ' + s.currency + order.dueAmount + ')' : 'Full Online Prepayment', at: now() });
    }
    if (c.coupon) c.coupon.usedCount = (c.coupon.usedCount || 0) + 1;
    D().orders.push(order);
    const payNote = order.paymentStatus === 'paid'
      ? 'Paid ' + s.currency + order.paidAmount + ' via ' + provider
      : order.paymentStatus === 'partial'
        ? 'Prepaid ' + s.currency + order.paidAmount + ' via ' + provider + ' · Due COD: ' + s.currency + order.dueAmount
        : 'Cash on Delivery (' + s.currency + order.total + ')';
    setStatus(order, 'pending', user.name, 'Pickup on ' + pickupDate + ' (' + body.pickupSlot + ') · ' + payNote);
    notifyAdmins('New order ' + order.code, user.name + ' placed an order of ' + s.currency + order.total + ' (' + payNote + ')', order.id);
    save();
    return enrichOrder(order, 'customer');
  });

  route('GET', '/api/orders', ['customer', 'rider', 'admin'], ({ user, query }) => {
    let list = D().orders;
    if (user.role === 'customer') list = list.filter(o => o.customerId === user.id);
    if (user.role === 'rider') list = list.filter(o => o.pickupRiderId === user.id || o.deliveryRiderId === user.id);
    if (query.status) list = list.filter(o => query.status.split(',').includes(o.status));
    if (query.q) {
      const q = query.q.toLowerCase();
      list = list.filter(o => {
        const c = customerBrief(o.customerId) || {};
        return o.code.toLowerCase().includes(q) || (c.name || '').toLowerCase().includes(q) || (c.phone || '').includes(q);
      });
    }
    return list.slice().reverse().map(o => enrichOrder(o, user.role));
  });

  function getOrderFor(user, id) {
    const o = D().orders.find(x => x.id === Number(id));
    if (!o) fail(404, 'Order not found');
    if (user.role === 'customer' && o.customerId !== user.id) fail(404, 'Order not found');
    if (user.role === 'rider' && o.pickupRiderId !== user.id && o.deliveryRiderId !== user.id) fail(404, 'Order not found');
    return o;
  }

  route('GET', '/api/orders/:id', ['customer', 'rider', 'admin'], ({ user, params }) => enrichOrder(getOrderFor(user, params.id), user.role));

  route('POST', '/api/orders/:id/pay', ['customer', 'rider', 'admin'], ({ user, params, body }) => {
    const o = syncOrderPayment(getOrderFor(user, params.id));
    if (o.status === 'cancelled') fail(400, 'Cannot pay for a cancelled order');
    if (o.dueAmount <= 0 || o.paymentStatus === 'paid') fail(400, 'Order is already fully paid');
    const s = D().settings;
    let amt = +num(body.amount, o.dueAmount).toFixed(2);
    if (amt <= 0) fail(400, 'Payment amount must be greater than 0');
    if (amt > o.dueAmount) amt = o.dueAmount;
    const provider = str(body.provider, 40) || 'bKash';
    const account = str(body.account, 40) || '';
    const txn = str(body.transactionId, 40) || (provider.slice(0, 3).toUpperCase() + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 65535).toString(16).toUpperCase());
    o.paidAmount = +(o.paidAmount + amt).toFixed(2);
    o.dueAmount = +Math.max(0, o.total - o.paidAmount).toFixed(2);
    o.paymentProvider = provider;
    o.transactionId = txn;
    o.paymentStatus = o.dueAmount <= 0 ? 'paid' : 'partial';
    if (o.paymentMethod === 'cod') {
      o.paymentMethod = o.dueAmount <= 0 ? 'online' : 'prepayment';
    }
    const note = o.dueAmount <= 0
      ? 'Paid ' + s.currency + amt + ' online via ' + provider + ' (Fully Paid)'
      : 'Paid ' + s.currency + amt + ' advance via ' + provider + ' (Remaining Due: ' + s.currency + o.dueAmount + ')';
    o.payments.push({ id: 'PAY-' + Date.now(), amount: amt, method: 'online', provider, account, transactionId: txn, note, at: now() });
    o.updatedAt = now();
    o.timeline.push({ status: o.status, label: 'Online Payment Received', at: now(), by: user.name, note: note + ' · Txn: ' + txn });
    notify(o.customerId, 'Payment confirmed for ' + o.code, note + ' (Txn: ' + txn + ')', o.id);
    notifyAdmins('Payment received — ' + o.code, user.name + ': ' + note, o.id);
    save();
    return enrichOrder(o, user.role);
  });

  route('POST', '/api/orders/:id/cancel', ['customer', 'admin'], ({ user, params, body }) => {
    const o = syncOrderPayment(getOrderFor(user, params.id));
    if (user.role === 'customer' && !['pending', 'pickup_assigned'].includes(o.status)) fail(400, 'Order can only be cancelled before pickup');
    if (['delivered', 'cancelled'].includes(o.status)) fail(400, 'Order is already ' + o.status);
    const reason = str(body.reason, 200) || (user.role === 'admin' ? 'Cancelled by admin' : 'Cancelled by customer');
    if (o.pickupRiderId && o.status === 'pickup_assigned') notify(o.pickupRiderId, 'Pickup cancelled', 'Order ' + o.code + ' was cancelled.', o.id);
    setStatus(o, 'cancelled', user.name, reason);
    if (o.paidAmount > 0 || ['paid', 'partial'].includes(o.paymentStatus)) { o.paymentStatus = 'refund_pending'; }
    if (user.role === 'customer') notifyAdmins('Order cancelled', o.code + ' cancelled by customer', o.id);
    save();
    return enrichOrder(o, user.role);
  });

  route('POST', '/api/orders/:id/rate', ['customer'], ({ user, params, body }) => {
    const o = getOrderFor(user, params.id);
    if (o.status !== 'delivered') fail(400, 'You can rate only delivered orders');
    const r = Math.round(num(body.rating, 0));
    if (r < 1 || r > 5) fail(400, 'Rating must be 1-5');
    o.rating = r;
    o.riderRating = body.riderRating ? Math.max(1, Math.min(5, Math.round(num(body.riderRating, 5)))) : r;
    o.review = str(body.review, 500);
    save();
    return enrichOrder(o, 'customer');
  });

  function creditRider(o, type) {
    const riderId = type === 'delivery' ? o.deliveryRiderId : o.pickupRiderId;
    if (!riderId) return;
    if (D().earnings.some(e => e.orderId === o.id && e.type === type)) return;
    D().earnings.push({ id: nextId('earning'), riderId, orderId: o.id, orderCode: o.code, type, amount: D().settings.riderFeePerTask, at: now() });
  }

  const RIDER_FLOW = {
    pickup_assigned: { next: 'picked_up', who: 'pickupRiderId' },
    picked_up: { next: 'at_laundry', who: 'pickupRiderId' },
    delivery_assigned: { next: 'out_for_delivery', who: 'deliveryRiderId' },
    out_for_delivery: { next: 'delivered', who: 'deliveryRiderId' }
  };

  route('POST', '/api/rider/orders/:id/advance', ['rider'], ({ user, params, body }) => {
    if (!user.approved) fail(403, 'Your rider account is pending approval');
    const o = syncOrderPayment(getOrderFor(user, params.id));
    const step = RIDER_FLOW[o.status];
    if (!step || o[step.who] !== user.id) fail(400, 'No action available for you on this order');
    const s = D().settings;
    if (step.next === 'delivered' && o.dueAmount > 0 && o.paymentStatus !== 'paid') {
      if (!body.cashCollected) fail(400, 'Please confirm cash collected (' + s.currency + o.dueAmount + ')');
      const collected = o.dueAmount;
      o.codAmountCollected = collected;
      o.paidAmount = o.total;
      o.dueAmount = 0;
      o.paymentStatus = 'paid';
      o.codCollectedBy = user.id;
      o.codSettled = false;
      o.payments.push({ id: 'PAY-' + Date.now(), amount: collected, method: 'cod', provider: 'Cash on Delivery', account: user.name, transactionId: 'COD-' + o.id, note: 'Cash collected by rider on delivery', at: now() });
    }
    setStatus(o, step.next, user.name, str(body.note, 200));
    if (step.next === 'at_laundry' || step.next === 'delivered') {
      creditRider(o, step.next === 'delivered' ? 'delivery' : 'pickup');
      notifyAdmins('Order ' + o.code, user.name + ': ' + STATUS_LABEL[step.next], o.id);
    }
    save();
    return enrichOrder(o, 'rider');
  });

  route('PUT', '/api/rider/availability', ['rider'], ({ user, body }) => {
    if (!user.approved) fail(403, 'Your rider account is pending approval');
    user.available = !!body.available;
    save();
    return publicUser(user);
  });

  const codAmountOf = o => o.codAmountCollected !== undefined ? o.codAmountCollected : o.total;

  route('GET', '/api/rider/summary', ['rider'], ({ user }) => {
    const e = D().earnings.filter(x => x.riderId === user.id);
    const todayStr = localDay(Date.now());
    const mine = D().orders.filter(o => o.pickupRiderId === user.id || o.deliveryRiderId === user.id);
    const cashInHand = D().orders.filter(o => o.codCollectedBy === user.id && !o.codSettled).reduce((a, o) => a + codAmountOf(o), 0);
    const ratings = mine.filter(o => o.riderRating && o.deliveryRiderId === user.id).map(o => o.riderRating);
    return {
      totalEarnings: e.reduce((a, x) => a + x.amount, 0),
      todayEarnings: e.filter(x => localDay(x.at) === todayStr).reduce((a, x) => a + x.amount, 0),
      tasksCompleted: e.length,
      activeTasks: mine.filter(o => (RIDER_FLOW[o.status] && o[RIDER_FLOW[o.status].who] === user.id)).length,
      cashInHand,
      rating: ratings.length ? +(ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : null,
      earnings: e.slice().reverse()
    };
  });

  const ADMIN = ['admin'];

  route('GET', '/api/admin/stats', ADMIN, () => {
    const o = D().orders, todayStr = localDay(Date.now());
    const byStatus = {};
    Object.keys(STATUS_LABEL).forEach(k => { byStatus[k] = 0; });
    o.forEach(x => { byStatus[x.status]++; });
    const valid = o.filter(x => x.status !== 'cancelled');
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = localDay(Date.now() - i * 864e5);
      const dayOrders = valid.filter(x => localDay(x.createdAt) === d);
      days.push({ date: d, orders: dayOrders.length, revenue: dayOrders.reduce((a, x) => a + x.total, 0) });
    }
    return {
      totalOrders: o.length,
      todayOrders: o.filter(x => localDay(x.createdAt) === todayStr).length,
      revenue: valid.reduce((a, x) => a + (syncOrderPayment(x).paidAmount || 0), 0),
      pendingRevenue: valid.reduce((a, x) => a + (syncOrderPayment(x).dueAmount || 0), 0),
      customers: D().users.filter(u => u.role === 'customer').length,
      riders: D().users.filter(u => u.role === 'rider' && u.approved).length,
      pendingRiders: D().users.filter(u => u.role === 'rider' && !u.approved && u.status !== 'blocked').length,
      availableRiders: D().users.filter(u => u.role === 'rider' && u.approved && u.available && u.status === 'active').length,
      unsettledCash: o.filter(x => x.codCollectedBy && !x.codSettled).reduce((a, x) => a + codAmountOf(x), 0),
      byStatus, days,
      recent: o.slice(-8).reverse().map(x => enrichOrder(x, 'admin'))
    };
  });

  route('POST', '/api/admin/orders/:id/assign', ADMIN, ({ user, params, body }) => {
    const o = getOrderFor(user, params.id);
    const rider = D().users.find(u => u.id === Number(body.riderId) && u.role === 'rider');
    if (!rider || !rider.approved || rider.status !== 'active') fail(400, 'Select a valid, approved rider');
    if (body.type === 'pickup') {
      if (!['pending', 'pickup_assigned'].includes(o.status)) fail(400, 'Pickup can be assigned only before pickup');
      o.pickupRiderId = rider.id;
      setStatus(o, 'pickup_assigned', user.name, rider.name + ' will pick up your items');
      notify(rider.id, 'New pickup task', o.code + ' - ' + o.pickupAddress.area + ', ' + o.pickupDate + ' ' + o.pickupSlot, o.id);
    } else if (body.type === 'delivery') {
      if (!['ready', 'delivery_assigned'].includes(o.status)) fail(400, 'Order must be "Ready" before assigning delivery');
      o.deliveryRiderId = rider.id;
      setStatus(o, 'delivery_assigned', user.name, rider.name + ' will deliver your items');
      notify(rider.id, 'New delivery task', o.code + ' - ' + o.deliveryAddress.area, o.id);
    } else fail(400, 'Invalid assignment type');
    save();
    return enrichOrder(o, 'admin');
  });

  route('POST', '/api/admin/orders/:id/status', ADMIN, ({ user, params, body }) => {
    const o = getOrderFor(user, params.id);
    if (!STATUS_LABEL[body.status]) fail(400, 'Invalid status');
    if (body.status === 'cancelled') fail(400, 'Use the cancel action');
    setStatus(o, body.status, user.name, str(body.note, 200));
    if (body.status === 'at_laundry') creditRider(o, 'pickup');
    if (body.status === 'delivered') creditRider(o, 'delivery');
    save();
    return enrichOrder(o, 'admin');
  });

  route('PUT', '/api/admin/orders/:id/payment', ADMIN, ({ user, params, body }) => {
    const o = syncOrderPayment(getOrderFor(user, params.id));
    if (!['paid', 'partial', 'unpaid', 'refunded', 'refund_pending'].includes(body.paymentStatus)) fail(400, 'Invalid payment status');
    o.paymentStatus = body.paymentStatus;
    if (body.paymentStatus === 'paid') { o.paidAmount = o.total; o.dueAmount = 0; }
    else if (body.paymentStatus === 'unpaid') { o.paidAmount = 0; o.dueAmount = o.total; }
    if (body.codSettled !== undefined) o.codSettled = !!body.codSettled;
    o.updatedAt = now();
    save();
    return enrichOrder(o, 'admin');
  });

  route('POST', '/api/admin/riders/:id/settle', ADMIN, ({ params }) => {
    let total = 0;
    D().orders.forEach(o => { if (o.codCollectedBy === Number(params.id) && !o.codSettled) { o.codSettled = true; total += codAmountOf(o); } });
    notify(Number(params.id), 'Cash settled', 'Admin received ' + D().settings.currency + total + ' cash from you.', null);
    save();
    return { settled: total };
  });

  route('GET', '/api/admin/users', ADMIN, ({ query }) => {
    let list = D().users;
    if (query.role) list = list.filter(u => u.role === query.role);
    return list.map(u => {
      const p = publicUser(u);
      if (u.role === 'customer') {
        const os = D().orders.filter(o => o.customerId === u.id);
        p.orderCount = os.length;
        p.totalSpent = os.filter(o => o.status !== 'cancelled').reduce((a, o) => a + o.total, 0);
      }
      if (u.role === 'rider') {
        p.tasksCompleted = D().earnings.filter(e => e.riderId === u.id).length;
        p.earnings = D().earnings.filter(e => e.riderId === u.id).reduce((a, e) => a + e.amount, 0);
        p.cashInHand = D().orders.filter(o => o.codCollectedBy === u.id && !o.codSettled).reduce((a, o) => a + codAmountOf(o), 0);
        p.activeTasks = D().orders.filter(o => RIDER_FLOW[o.status] && o[RIDER_FLOW[o.status].who] === u.id).length;
      }
      return p;
    }).reverse();
  });

  route('POST', '/api/admin/users', ADMIN, ({ body }) => {
    const role = ['customer', 'rider', 'admin'].includes(body.role) ? body.role : 'customer';
    const email = str(body.email, 120).toLowerCase();
    if (!str(body.name) || !isEmail(email)) fail(400, 'Name and valid email required');
    if (String(body.password || '').length < 6) fail(400, 'Password must be at least 6 characters');
    if (D().users.some(u => u.email === email)) fail(409, 'Email already exists');
    const u = { id: nextId('user'), role, name: str(body.name, 80), email, phone: str(body.phone, 20), password: hashPassword(body.password), status: 'active', createdAt: now() };
    if (role === 'customer') u.addresses = [];
    if (role === 'rider') Object.assign(u, { approved: true, available: false, vehicle: str(body.vehicle, 40) || 'Motorbike', vehicleNumber: str(body.vehicleNumber, 40), area: str(body.area, 80), nid: str(body.nid, 30) });
    D().users.push(u);
    save();
    return publicUser(u);
  });

  route('PUT', '/api/admin/users/:id', ADMIN, ({ user, params, body }) => {
    const u = D().users.find(x => x.id === Number(params.id));
    if (!u) fail(404, 'User not found');
    if (u.id === user.id && body.status === 'blocked') fail(400, 'You cannot block yourself');
    if (body.status && ['active', 'blocked'].includes(body.status)) {
      u.status = body.status;
      if (u.role === 'rider' && body.status === 'blocked') u.available = false;
    }
    if (body.approved !== undefined && u.role === 'rider') {
      u.approved = !!body.approved;
      notify(u.id, u.approved ? 'Account approved 🎉' : 'Approval revoked', u.approved ? 'You can now go online and receive tasks.' : 'Contact admin for details.', null);
    }
    ['name', 'phone', 'vehicle', 'vehicleNumber', 'area'].forEach(k => { if (body[k] !== undefined) u[k] = str(body[k], 80); });
    if (body.password) { if (String(body.password).length < 6) fail(400, 'Password too short'); u.password = hashPassword(body.password); }
    save();
    return publicUser(u);
  });

  route('GET', '/api/admin/services', ADMIN, () => D().services);
  function cleanService(b, existing) {
    const s = Object.assign({}, existing || {});
    if (b.name !== undefined) s.name = str(b.name, 80);
    if (b.category !== undefined) s.category = str(b.category, 60);
    if (b.unit !== undefined) s.unit = str(b.unit, 20) || 'piece';
    if (b.price !== undefined) s.price = Math.max(0, num(b.price, 0));
    if (b.icon !== undefined) s.icon = str(b.icon, 8) || '🧺';
    if (b.description !== undefined) s.description = str(b.description, 300);
    if (b.active !== undefined) s.active = !!b.active;
    if (!s.name || !s.category) fail(400, 'Name and category are required');
    return s;
  }
  route('POST', '/api/admin/services', ADMIN, ({ body }) => {
    const s = cleanService(Object.assign({ unit: 'piece', icon: '🧺', active: true, description: '' }, body));
    s.id = nextId('service'); s.createdAt = now();
    D().services.push(s); save(); return s;
  });
  route('PUT', '/api/admin/services/:id', ADMIN, ({ params, body }) => {
    const i = D().services.findIndex(x => x.id === Number(params.id));
    if (i < 0) fail(404, 'Service not found');
    D().services[i] = cleanService(body, D().services[i]); save(); return D().services[i];
  });
  route('DELETE', '/api/admin/services/:id', ADMIN, ({ params }) => {
    D().services = D().services.filter(x => x.id !== Number(params.id)); save(); return { ok: true };
  });

  route('GET', '/api/admin/coupons', ADMIN, () => D().coupons);
  function cleanCoupon(b, existing) {
    const c = Object.assign({}, existing || {});
    if (b.code !== undefined) c.code = str(b.code, 30).toUpperCase().replace(/\s+/g, '');
    if (b.type !== undefined) c.type = b.type === 'flat' ? 'flat' : 'percent';
    if (b.value !== undefined) c.value = Math.max(0, num(b.value, 0));
    if (b.minOrder !== undefined) c.minOrder = Math.max(0, num(b.minOrder, 0));
    if (b.maxDiscount !== undefined) c.maxDiscount = Math.max(0, num(b.maxDiscount, 0));
    if (b.expiresAt !== undefined) c.expiresAt = str(b.expiresAt, 10);
    if (b.active !== undefined) c.active = !!b.active;
    if (!c.code || !c.value) fail(400, 'Code and value are required');
    if (c.type === 'percent' && c.value > 100) fail(400, 'Percent cannot exceed 100');
    return c;
  }
  route('POST', '/api/admin/coupons', ADMIN, ({ body }) => {
    const c = cleanCoupon(Object.assign({ type: 'percent', minOrder: 0, maxDiscount: 0, active: true, expiresAt: '' }, body));
    if (D().coupons.some(x => x.code === c.code)) fail(409, 'Coupon code exists');
    c.id = nextId('coupon'); c.usedCount = 0; c.createdAt = now();
    D().coupons.push(c); save(); return c;
  });
  route('PUT', '/api/admin/coupons/:id', ADMIN, ({ params, body }) => {
    const i = D().coupons.findIndex(x => x.id === Number(params.id));
    if (i < 0) fail(404, 'Coupon not found');
    const c = cleanCoupon(body, D().coupons[i]);
    if (D().coupons.some(x => x.code === c.code && x.id !== c.id)) fail(409, 'Coupon code exists');
    D().coupons[i] = c; save(); return c;
  });
  route('DELETE', '/api/admin/coupons/:id', ADMIN, ({ params }) => {
    D().coupons = D().coupons.filter(x => x.id !== Number(params.id)); save(); return { ok: true };
  });

  route('GET', '/api/admin/settings', ADMIN, () => D().settings);
  route('PUT', '/api/admin/settings', ADMIN, ({ body }) => {
    const s = D().settings;
    ['businessName', 'currency', 'supportPhone', 'supportEmail'].forEach(k => { if (body[k] !== undefined) s[k] = str(body[k], 100); });
    ['deliveryFee', 'freeDeliveryAbove', 'expressSurchargePercent', 'minOrderAmount', 'riderFeePerTask', 'prepaymentMinPercent'].forEach(k => { if (body[k] !== undefined) s[k] = Math.max(0, num(body[k], s[k])); });
    ['timeSlots', 'serviceAreas'].forEach(k => {
      if (body[k] !== undefined) {
        const arr = (Array.isArray(body[k]) ? body[k] : String(body[k]).split('\n')).map(x => str(x, 60)).filter(Boolean);
        if (!arr.length) fail(400, k + ' cannot be empty');
        s[k] = arr;
      }
    });
    save();
    return s;
  });

  window.LocalBackend = {
    handle(method, url, body, token) {
      const u = new URL(url, 'http://localhost');
      const pathname = u.pathname;
      let match = null, params = {};
      for (const r of routes) {
        if (r.method !== method) continue;
        const m = pathname.match(r.re);
        if (m) { match = r; r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); }); break; }
      }
      if (!match) fail(404, 'API route not found');
      let user = null;
      if (match.roles) {
        const tok = readToken(token);
        user = tok && D().users.find(x => x.id === tok.id);
        if (!user) fail(401, 'Please log in');
        if (user.status === 'blocked') fail(403, 'Your account has been blocked');
        if (!match.roles.includes(user.role)) fail(403, 'You do not have access to this action');
      }
      const query = Object.fromEntries(u.searchParams.entries());
      const res = match.handler({ user, params, query, body: body || {} });
      return JSON.parse(JSON.stringify(res));
    }
  };
})();

