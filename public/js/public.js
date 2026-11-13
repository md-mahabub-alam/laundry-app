'use strict';
/* ================= Public pages: landing, login, register ================= */

page('/', {
  render(el) {
    const s = S.config.settings;
    const cats = {};
    S.config.services.forEach(v => { (cats[v.category] = cats[v.category] || []).push(v); });
    el.innerHTML = `
      <nav class="lnav"><div class="logo">🧺 ${esc(s.businessName)}</div>
        <div class="flex"><a class="hide-m" href="#pricing" onclick="document.getElementById('pricing').scrollIntoView({behavior:'smooth'});return false">Pricing</a>
        ${S.user ? `<a class="btn" href="#${home()}">Go to Dashboard</a>` : `<a class="btn ghost" href="#/login">Login</a><a class="btn" href="#/register">Sign Up</a>`}</div></nav>
      <section class="hero"><div>
        <h1>Laundry & Dry Cleaning,<br>Picked Up & Delivered.</h1>
        <p>Schedule a pickup in 60 seconds. Our rider collects your clothes from your door, we clean them with care, and deliver them back fresh & folded.</p>
        <div class="flex wrap mt"><a class="btn accent lg" href="#${S.user ? home() : '/register'}">Schedule a Pickup →</a><a class="btn outline lg" style="background:transparent;color:#fff;border-color:#fff" href="#/register/rider">Become a Rider</a></div>
        <div class="pills"><span>✅ Free pickup above ${money(s.freeDeliveryAbove)}</span><span>⚡ Express service</span><span>📍 Live order tracking</span><span>💵 Cash on delivery</span></div>
      </div><div class="art">🧺</div></section>
      <section class="section"><h2>How it works</h2><p class="sub">Four simple steps to fresh clothes</p>
        <div class="steps">
          <div class="step"><div class="n">📱</div><h3>Place Order</h3><p class="muted">Pick items, choose pickup date & time slot.</p></div>
          <div class="step"><div class="n">🛵</div><h3>We Pick Up</h3><p class="muted">A verified rider collects from your doorstep.</p></div>
          <div class="step"><div class="n">🫧</div><h3>We Clean</h3><p class="muted">Washed, dry-cleaned & ironed by professionals.</p></div>
          <div class="step"><div class="n">🏠</div><h3>We Deliver</h3><p class="muted">Fresh clothes back at your door. Pay on delivery.</p></div>
        </div></section>
      <section class="section" id="pricing" style="background:#fff"><h2>Transparent Pricing</h2><p class="sub">No hidden charges. Pickup & delivery ${money(s.deliveryFee)} (free above ${money(s.freeDeliveryAbove)}).</p>
        ${Object.keys(cats).map(c => `<div class="cat-title">${esc(c)}</div><div class="price-grid">${cats[c].map(v => `<div class="price-item"><span class="pi">${esc(v.icon)}</span><span>${esc(v.name)}</span><span class="pp">${money(v.price)}<span class="muted small">/${esc(v.unit)}</span></span></div>`).join('')}</div>`).join('')}
      </section>
      <section class="cta-band"><div><h2>Earn with us — become a delivery rider</h2><p style="margin:6px 0 0">Flexible hours. ${money(s.riderFeePerTask)} per completed pickup/delivery.</p></div><a class="btn lg" style="background:#fff;color:var(--accent)" href="#/register/rider">Apply as Rider</a></section>
      <footer class="footer"><div>© ${new Date().getFullYear()} ${esc(s.businessName)}. All rights reserved.</div><div>📞 ${esc(s.supportPhone)} · ✉️ ${esc(s.supportEmail)}</div><div>Serving: ${s.serviceAreas.map(esc).join(', ')}</div></footer>`;
  }
});

page('/login', {
  guestOnly: true,
  render(el) {
    const s = S.config.settings;
    el.innerHTML = `<div class="auth-wrap">
      <div class="auth-side"><a href="#/" style="color:#fff" class="logo">🧺 ${esc(s.businessName)}</a><h1 class="mt">Welcome back!</h1><p style="opacity:.9">Track your orders, manage pickups and deliveries — all in one place.</p></div>
      <div class="auth-form"><div class="auth-box">
        <a href="#/" class="small">← Home</a>
        <h2 class="mt">Log in to your account</h2><p class="muted">Customers, riders and admins log in here.</p>
        <form id="lf">
          <div class="field"><label>Email</label><input name="email" type="email" required autocomplete="username"></div>
          <div class="field"><label>Password</label><input name="password" type="password" required autocomplete="current-password"></div>
          <button class="btn block lg">Log In</button>
        </form>
        <p class="center">New here? <a href="#/register">Create an account</a></p>
        <div class="demo-box"><b>Demo accounts</b> (click to fill)<br>
          <button class="btn sm outline" data-demo="admin@freshfold.com|admin123">Admin</button>
          <button class="btn sm outline" data-demo="customer@demo.com|123456">Customer</button>
          <button class="btn sm outline" data-demo="rider@demo.com|123456">Rider</button></div>
      </div></div></div>`;
    $$('[data-demo]', el).forEach(b => b.onclick = () => { const [e, p] = b.dataset.demo.split('|'); $('[name=email]').value = e; $('[name=password]').value = p; });
    $('#lf').onsubmit = e => {
      e.preventDefault();
      busy(e.submitter, async () => {
        setSession(await api('POST', '/api/auth/login', formData(e.target)));
        toast('Welcome, ' + S.user.name + '!');
        navigate(home());
      });
    };
  }
});

page('/register', {
  guestOnly: true,
  render(el) { renderRegister(el, 'customer'); }
});
page('/register/rider', {
  guestOnly: true,
  render(el) { renderRegister(el, 'rider'); }
});

function renderRegister(el, role) {
  const s = S.config.settings;
  el.innerHTML = `<div class="auth-wrap">
    <div class="auth-side"><a href="#/" style="color:#fff" class="logo">🧺 ${esc(s.businessName)}</a>
      <h1 class="mt" id="rs-title"></h1><p style="opacity:.9" id="rs-sub"></p></div>
    <div class="auth-form"><div class="auth-box">
      <a href="#/" class="small">← Home</a>
      <h2 class="mt">Create your account</h2>
      <div class="seg"><button type="button" data-role="customer">🧺 I need laundry</button><button type="button" data-role="rider">🛵 I want to be a rider</button></div>
      <form id="rf">
        <div class="field"><label>Full name</label><input name="name" required></div>
        <div class="grid2"><div class="field"><label>Email</label><input name="email" type="email" required></div>
        <div class="field"><label>Phone</label><input name="phone" required placeholder="01XXXXXXXXX"></div></div>
        <div class="field"><label>Password</label><input name="password" type="password" minlength="6" required></div>
        <div id="cust-fields">
          <div class="grid2"><div class="field"><label>Area</label><select name="area_c">${areaOptions()}</select></div>
          <div class="field"><label>Address (optional)</label><input name="line" placeholder="House, road, block"></div></div>
        </div>
        <div id="rider-fields">
          <div class="grid2"><div class="field"><label>Vehicle type</label><select name="vehicle">${['Motorbike', 'Bicycle', 'Scooter', 'Car', 'Van'].map(v => `<option>${v}</option>`).join('')}</select></div>
          <div class="field"><label>Vehicle number</label><input name="vehicleNumber"></div></div>
          <div class="grid2"><div class="field"><label>Preferred area</label><select name="area">${areaOptions()}</select></div>
          <div class="field"><label>NID number</label><input name="nid"></div></div>
          <div class="notice info small">Rider accounts are reviewed and approved by admin before you can receive tasks.</div>
        </div>
        <button class="btn block lg">Create Account</button>
      </form>
      <p class="center">Already have an account? <a href="#/login">Log in</a></p>
    </div></div></div>`;
  let current = role;
  const setRole = r => {
    current = r;
    $$('.seg button', el).forEach(b => b.classList.toggle('active', b.dataset.role === r));
    $('#cust-fields').classList.toggle('hidden', r !== 'customer');
    $('#rider-fields').classList.toggle('hidden', r !== 'rider');
    $('#rs-title').textContent = r === 'rider' ? 'Ride with us & earn' : 'Fresh clothes, zero hassle';
    $('#rs-sub').textContent = r === 'rider' ? 'Get pickup & delivery tasks near you and earn ' + money(s.riderFeePerTask) + ' per task.' : 'Doorstep pickup & delivery for all your laundry and dry cleaning.';
  };
  $$('.seg button', el).forEach(b => b.onclick = () => setRole(b.dataset.role));
  setRole(role);
  $('#rf').onsubmit = e => {
    e.preventDefault();
    const d = formData(e.target);
    const body = { role: current, name: d.name, email: d.email, phone: d.phone, password: d.password };
    if (current === 'customer') { if (d.line) body.address = { label: 'Home', line: d.line, area: d.area_c, phone: d.phone }; }
    else Object.assign(body, { vehicle: d.vehicle, vehicleNumber: d.vehicleNumber, area: d.area, nid: d.nid });
    busy(e.submitter, async () => {
      setSession(await api('POST', '/api/auth/register', body));
      toast('Account created. Welcome, ' + S.user.name + '!');
      navigate(home());
    });
  };
}
