// Simple, dependency-free JSON file database with atomic writes.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, 'data');
const FILE = path.join(DATA_DIR, 'db.json');

function hashPassword(pw, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  return salt + ':' + crypto.scryptSync(String(pw), salt, 64).toString('hex');
}

function verifyPassword(pw, stored) {
  if (!stored || stored.indexOf(':') === -1) return false;
  const [salt, h] = stored.split(':');
  const calc = crypto.scryptSync(String(pw), salt, 64);
  const buf = Buffer.from(h, 'hex');
  return buf.length === calc.length && crypto.timingSafeEqual(calc, buf);
}

function now() { return new Date().toISOString(); }

function seed() {
  const t = now();
  const d = {
    secret: crypto.randomBytes(32).toString('hex'),
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

let data;
function load(reset) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (reset || !fs.existsSync(FILE)) {
    data = seed();
    writeNow();
  } else {
    data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  }
  return data;
}

function writeNow() {
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, FILE);
}

let timer = null;
function save() {
  if (timer) return;
  timer = setTimeout(() => { timer = null; try { writeNow(); } catch (e) { console.error('DB write failed', e); } }, 50);
}

function nextId(name) {
  data.counters[name] = (data.counters[name] || 0) + 1;
  return data.counters[name];
}

module.exports = {
  load, save, nextId, now, hashPassword, verifyPassword,
  get data() { return data; }
};

