// Villa Rústica - carta y pedidos por WhatsApp
(() => {
  'use strict';

  const WHATSAPP = '19286554308';

  // ---- Datos (mismos precios que la app de pedidos) ----
  const COFFEES = [
    { id: 'espresso',   name: 'Espresso',   price: 2.5,  desc: 'Corto, intenso y con crema.' },
    { id: 'americano',  name: 'Americano',  price: 3,    desc: 'Espresso alargado con agua. Frío o caliente.' },
    { id: 'cappuccino', name: 'Cappuccino', price: 4,    desc: 'Espresso, leche y espuma cremosa.' },
    { id: 'flat',       name: 'Flat white', price: 4.25, desc: 'Espresso con leche sedosa y poca espuma.' },
    { id: 'latte',      name: 'Latte',      price: 4.5,  desc: 'Suave y cremoso, con mucha leche. Frío o caliente.' },
  ];
  const MILKS = [
    { id: 'none',  name: 'Sin leche',     label: 'Sin leche',          price: 0 },
    { id: 'desl',  name: 'Deslactosada',  label: 'Leche deslactosada', price: 0.5 },
    { id: 'alm',   name: 'Almendra',      label: 'Leche de almendra',  price: 0.75 },
    { id: 'avena', name: 'Avena',         label: 'Leche de avena',     price: 1 },
  ];
  const TOPPINGS = [
    { id: 'vainilla',   name: 'Vainilla',   price: 0.5 },
    { id: 'lavanda',    name: 'Lavanda',    price: 0.6 },
    { id: 'piloncillo', name: 'Piloncillo', price: 0.4 },
  ];
  const BG = {
    vainilla: '#f7ecc9', lavanda: '#e4dcee', piloncillo: '#efd9bd',
    avena: '#f3e7c4', alm: '#efdcc4', desl: '#e2ece8', none: '#ece6d8',
    hot: '#f3d9c4', cold: '#dce8e8',
  };

  // Reglas del menú: sin leche solo en espresso/americano; frío/caliente en latte/americano
  const allowsNoMilk = (id) => id === 'espresso' || id === 'americano';
  const hasTemp = (id) => id === 'latte' || id === 'americano';

  const money = (v) => '$' + v.toFixed(2);
  const $ = (id) => document.getElementById(id);
  const by = (arr, id) => arr.find((x) => x.id === id);

  // ---- Ilustraciones SVG ----
  const CUP_STYLE = {
    espresso:   { r: 24, color: '#7a4a32', art: '<circle cx="78" cy="58" r="12" fill="#9b6444" opacity=".7"/><ellipse cx="73" cy="53" rx="5" ry="2.5" fill="#fff" opacity=".35"/>' },
    americano:  { r: 32, color: '#5a3a2c', art: '<circle cx="78" cy="58" r="22" fill="#6b4535"/><path d="M60 49Q67 42 78 42" stroke="#fff" stroke-width="3" fill="none" opacity=".35" stroke-linecap="round"/>' },
    latte:      { r: 32, color: '#d9a77c', art: '<path d="M78 76C50 59 61 40 78 52C95 40 106 59 78 76Z" fill="#fff6ee"/>' },
    cappuccino: { r: 32, color: '#fbeadb', art: '<circle cx="78" cy="58" r="22" fill="#f1d2b4"/><circle cx="67" cy="51" r="2" fill="#7a4a32"/><circle cx="84" cy="47" r="2" fill="#7a4a32"/><circle cx="91" cy="61" r="2" fill="#7a4a32"/><circle cx="71" cy="68" r="2" fill="#7a4a32"/><circle cx="79" cy="58" r="2.5" fill="#7a4a32"/>' },
    flat:       { r: 32, color: '#c99468', art: '<ellipse cx="78" cy="58" rx="21" ry="16" fill="#fff6ee"/><ellipse cx="78" cy="58" rx="10" ry="8" fill="#c99468"/>' },
  };
  const cup = (id) => {
    const c = CUP_STYLE[id];
    return `<svg viewBox="0 0 156 116" role="img" aria-label="${by(COFFEES, id).name}">
      <circle cx="78" cy="58" r="52" fill="#fff" opacity=".85"/>
      <rect x="108" y="50" width="34" height="16" rx="8" fill="#fff" stroke="#e6dcc4" stroke-width="2"/>
      <circle cx="78" cy="58" r="${c.r + 7}" fill="#fff" stroke="#e6dcc4" stroke-width="2"/>
      <circle cx="78" cy="58" r="${c.r}" fill="${c.color}"/>${c.art}</svg>`;
  };
  const ICONS = {
    vainilla: '<path d="M8 42C16 32 28 20 42 8" stroke="#6b4332" stroke-width="5" fill="none" stroke-linecap="round"/><g transform="translate(17 17)" fill="#fffaf0" stroke="#e8d7a8" stroke-width="1.5"><ellipse cy="-6" rx="3.5" ry="6"/><ellipse cy="-6" rx="3.5" ry="6" transform="rotate(72)"/><ellipse cy="-6" rx="3.5" ry="6" transform="rotate(144)"/><ellipse cy="-6" rx="3.5" ry="6" transform="rotate(216)"/><ellipse cy="-6" rx="3.5" ry="6" transform="rotate(288)"/></g><circle cx="17" cy="17" r="3" fill="#f2c94c"/>',
    lavanda: '<path d="M24 44V18" stroke="#7a9a6a" stroke-width="2.5" stroke-linecap="round"/><path d="M24 38Q15 36 13 29M24 34Q33 32 35 25" stroke="#7a9a6a" stroke-width="2.5" fill="none" stroke-linecap="round"/><g fill="#b79cf2"><ellipse cx="24" cy="8" rx="3" ry="4.5"/><ellipse cx="19" cy="14" rx="3" ry="4.5" transform="rotate(-20 19 14)"/><ellipse cx="29" cy="14" rx="3" ry="4.5" transform="rotate(20 29 14)"/><ellipse cx="24" cy="17" rx="3" ry="4.5"/><ellipse cx="20" cy="22" rx="3" ry="4" transform="rotate(-20 20 22)"/><ellipse cx="28" cy="22" rx="3" ry="4" transform="rotate(20 28 22)"/></g>',
    piloncillo: '<ellipse cx="24" cy="38" rx="13" ry="4" fill="#8a5028"/><path d="M11 38L16 14H32L37 38Z" fill="#a8683a"/><ellipse cx="24" cy="14" rx="8" ry="3" fill="#c98a55"/><path d="M19 22L17 34" stroke="#8a5028" stroke-width="2.5" stroke-linecap="round"/>',
    avena: '<path d="M24 44V12" stroke="#b08a4a" stroke-width="2.5" stroke-linecap="round"/><g fill="#e6c36a"><ellipse cx="18" cy="17" rx="3.5" ry="6" transform="rotate(-30 18 17)"/><ellipse cx="30" cy="17" rx="3.5" ry="6" transform="rotate(30 30 17)"/><ellipse cx="18" cy="29" rx="3.5" ry="6" transform="rotate(-30 18 29)"/><ellipse cx="30" cy="29" rx="3.5" ry="6" transform="rotate(30 30 29)"/><ellipse cx="24" cy="9" rx="3" ry="6"/></g>',
    alm: '<path d="M24 6C37 13 39 31 24 43C9 31 11 13 24 6Z" fill="#d9a066"/><path d="M24 14V35" stroke="#b9783a" stroke-width="2" stroke-linecap="round"/><path d="M16 20Q17 14 21 11" stroke="#f2cfa0" stroke-width="2" fill="none" stroke-linecap="round"/>',
    desl: '<path d="M24 5C34 19 38 25 38 31A14 14 0 0 1 10 31C10 25 14 19 24 5Z" fill="#dff1ff" stroke="#8ec5ee" stroke-width="2.5"/><path d="M17 32a7 7 0 0 0 6 7" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>',
    none: '<circle cx="24" cy="24" r="14" fill="none" stroke="#a89a82" stroke-width="3"/><path d="M14 34L34 14" stroke="#a89a82" stroke-width="3" stroke-linecap="round"/>',
    hot: '<path d="M24 5C27 14 36 18 36 29A12 12 0 0 1 12 29C12 22 17 20 18 13C21 16 22 11 24 5Z" fill="#e8873a"/><path d="M24 22C26 26 30 28 30 33A6 6 0 0 1 18 33C18 29 22 28 24 22Z" fill="#f6c453"/>',
    cold: '<rect x="10" y="10" width="28" height="28" rx="6" fill="#d6ecf2" stroke="#8cc3d1" stroke-width="2.5" transform="rotate(12 24 24)"/><path d="M17 19l6-4" stroke="#fff" stroke-width="3" stroke-linecap="round"/>',
  };
  const icon = (id) => `<svg viewBox="0 0 48 48" aria-hidden="true">${ICONS[id]}</svg>`;

  // ---- Estado ----
  const initial = () => ({ cafe: 'latte', milk: 'desl', tops: [], qty: 1, temp: 'hot' });
  let sel = initial();
  let cart = [];
  let last = null;
  try { last = JSON.parse(localStorage.getItem('vr-ultimo-pedido')); } catch (e) { last = null; }

  const tempOf = (o) => (hasTemp(o.cafe) ? o.temp : '');
  const unitPrice = (o) => by(COFFEES, o.cafe).price + by(MILKS, o.milk).price + o.tops.reduce((s, t) => s + by(TOPPINGS, t).price, 0);
  const describe = (o) => {
    const parts = [];
    if (tempOf(o)) parts.push(o.temp === 'cold' ? 'Frío' : 'Caliente');
    if (o.milk !== 'none') parts.push(by(MILKS, o.milk).label);
    o.tops.forEach((t) => parts.push('Topping ' + by(TOPPINGS, t).name.toLowerCase()));
    return parts.join(' · ') || 'Sin extras';
  };

  // ---- Carta y listas estáticas ----
  $('menu-grid').innerHTML = COFFEES.map((c) => `
    <article class="menu-card reveal">
      <div class="im">${cup(c.id)}</div>
      <h3>${c.name}</h3>
      <p>${c.desc}</p>
      <span class="price">desde ${money(c.price)}</span>
    </article>`).join('');

  $('milk-list').innerHTML = MILKS.filter((m) => m.id !== 'none').map((m) => `
    <li><span class="ic" style="background:${BG[m.id]}">${icon(m.id)}</span><span class="nm">${m.label}</span><span class="pr">+${money(m.price)}</span></li>`).join('');
  $('topping-list').innerHTML = TOPPINGS.map((t) => `
    <li><span class="ic" style="background:${BG[t.id]}">${icon(t.id)}</span><span class="nm">${t.name}</span><span class="pr">+${money(t.price)}</span></li>`).join('');

  document.querySelectorAll('[data-cup]').forEach((el) => { el.innerHTML = cup(el.dataset.cup); });

  // ---- Constructor ----
  const chip = (attrs, role, checked, ic, bg, label, price) =>
    `<button type="button" class="chip" role="${role}" aria-checked="${checked}" ${attrs}>
       <span class="ic" style="background:${bg}">${icon(ic)}</span>
       <span>${label}<small>${price ? '+' + money(price) : 'sin costo'}</small></span></button>`;

  function renderBuilder() {
    $('opt-coffee').innerHTML = COFFEES.map((c) => `
      <button type="button" class="opt" role="radio" aria-checked="${sel.cafe === c.id}" data-cafe="${c.id}">
        <div class="im">${cup(c.id)}</div><b>${c.name}</b><span>desde ${money(c.price)}</span>
      </button>`).join('');

    $('fs-temp').hidden = !hasTemp(sel.cafe);
    $('opt-temp').innerHTML =
      chip('data-temp="hot"', 'radio', sel.temp === 'hot', 'hot', BG.hot, 'Caliente', 0) +
      chip('data-temp="cold"', 'radio', sel.temp === 'cold', 'cold', BG.cold, 'Frío', 0);

    $('opt-milk').innerHTML = MILKS
      .filter((m) => m.id !== 'none' || allowsNoMilk(sel.cafe))
      .map((m) => chip(`data-milk="${m.id}"`, 'radio', sel.milk === m.id, m.id, BG[m.id], m.name, m.price)).join('');

    $('opt-top').innerHTML = TOPPINGS
      .map((t) => chip(`data-top="${t.id}"`, 'checkbox', sel.tops.includes(t.id), t.id, BG[t.id], t.name, t.price)).join('');

    const u = unitPrice(sel);
    $('q-val').textContent = sel.qty;
    $('q-unit').textContent = money(u) + ' c/u';
    $('add-total').textContent = money(u * sel.qty);
  }

  document.querySelector('.builder').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const d = b.dataset;
    if (d.cafe) {
      sel.cafe = d.cafe;
      if (sel.milk === 'none' && !allowsNoMilk(d.cafe)) sel.milk = 'desl';
    } else if (d.temp) sel.temp = d.temp;
    else if (d.milk) sel.milk = d.milk;
    else if (d.top) {
      const i = sel.tops.indexOf(d.top);
      if (i < 0) sel.tops.push(d.top); else sel.tops.splice(i, 1);
    } else if (b.id === 'q-minus') sel.qty = Math.max(1, sel.qty - 1);
    else if (b.id === 'q-plus') sel.qty = Math.min(99, sel.qty + 1);
    else if (b.id === 'add-btn') {
      cart.push({ cafe: sel.cafe, milk: sel.milk, tops: sel.tops.slice(), qty: sel.qty, temp: sel.temp });
      sel = initial();
      setMsg('¡Agregado a tu pedido!');
      renderCart();
    }
    renderBuilder();
  });

  // ---- Carrito ----
  function setMsg(t) { $('cart-msg').textContent = t; }

  function comanda() {
    const nom = $('cli').value.trim() || 'Sin nombre';
    const total = cart.reduce((s, o) => s + unitPrice(o) * o.qty, 0);
    const lines = cart.map((o) => {
      const c = by(COFFEES, o.cafe);
      return `${o.qty} x ${c.name}${tempOf(o) ? ' (' + (o.temp === 'cold' ? 'frío' : 'caliente') + ')' : ''}\n   ${describe(o)}\n   ${money(unitPrice(o) * o.qty)}`;
    });
    return `PEDIDO VILLA RÚSTICA\nCliente: ${nom}\n--------------\n${lines.join('\n')}\n--------------\nTOTAL A PAGAR: ${money(total)}`;
  }

  function renderCart() {
    const total = cart.reduce((s, o) => s + unitPrice(o) * o.qty, 0);
    $('cart-list').innerHTML = cart.map((o, i) => `
      <li class="cart-item">
        <b>${o.qty} × ${by(COFFEES, o.cafe).name}</b>
        <span class="pr">${money(unitPrice(o) * o.qty)}</span>
        <small>${describe(o)}</small>
        <button type="button" class="rm" data-rm="${i}">Quitar</button>
      </li>`).join('');
    $('cart-empty').hidden = cart.length > 0;
    $('cart-total').textContent = money(total);
    const wa = $('wa-btn');
    wa.setAttribute('aria-disabled', String(cart.length === 0));
    wa.href = cart.length ? `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(comanda())}` : '#pedir';
    $('repeat-btn').hidden = !(last && last.length && cart.length === 0);
  }

  $('cart-list').addEventListener('click', (e) => {
    const b = e.target.closest('[data-rm]');
    if (!b) return;
    cart.splice(Number(b.dataset.rm), 1);
    setMsg('');
    renderCart();
  });
  $('cli').addEventListener('input', renderCart);

  function remember() {
    last = cart.map((o) => ({ ...o, tops: o.tops.slice() }));
    try { localStorage.setItem('vr-ultimo-pedido', JSON.stringify(last)); } catch (e) { /* sin almacenamiento */ }
  }
  $('wa-btn').addEventListener('click', (e) => {
    if (!cart.length) { e.preventDefault(); return; }
    renderCart();
    remember();
    setMsg('Se abrirá WhatsApp con tu pedido.');
  });
  $('copy-btn').addEventListener('click', () => {
    if (!cart.length) { setMsg('Agrega algo a tu pedido primero.'); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(comanda()).then(() => setMsg('¡Comanda copiada!'), () => setMsg('No se pudo copiar.'));
    } else setMsg('No se pudo copiar.');
  });
  $('repeat-btn').addEventListener('click', () => {
    if (!last) return;
    cart = last.filter((o) => by(COFFEES, o.cafe)).map((o) => ({ ...o, tops: (o.tops || []).filter((t) => by(TOPPINGS, t)) }));
    setMsg('Cargamos tu último pedido.');
    renderCart();
  });

  // ---- Navegación ----
  const header = document.querySelector('.site-header');
  const toggle = document.querySelector('.nav-toggle');
  const menu = $('menu-nav');
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  const closeMenu = () => { menu.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-label', 'Abrir menú'); };
  toggle.addEventListener('click', () => {
    const open = menu.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
  });
  menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', closeMenu));

  $('year').textContent = new Date().getFullYear();

  // ---- Aparición al hacer scroll ----
  const targets = document.querySelectorAll('.section-head, .split > *, .menu-card, .values > div, .price-list li, .builder, .cart');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('visible'); io.unobserve(en.target); } });
    }, { threshold: 0.1 });
    targets.forEach((el) => { el.classList.add('reveal'); io.observe(el); });
  }

  renderBuilder();
  renderCart();
})();
