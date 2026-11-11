// Villa Rústica · Comandera oficial
// Toma de pedidos por mesa o para llevar, pantalla de barra, cobro y caja del día.
// Los datos viven en localStorage y se sincronizan entre pestañas del mismo equipo.
(() => {
  'use strict';

  // ---- Carta oficial (mismos precios que la web de la cafetería) ----
  const COFFEES = [
    { id: 'espresso',   name: 'Espresso',   price: 2.5 },
    { id: 'americano',  name: 'Americano',  price: 3 },
    { id: 'cappuccino', name: 'Cappuccino', price: 4 },
    { id: 'flat',       name: 'Flat white', price: 4.25 },
    { id: 'latte',      name: 'Latte',      price: 4.5 },
  ];
  const MILKS = [
    { id: 'none',  name: 'Sin leche',    label: 'Sin leche',          price: 0 },
    { id: 'desl',  name: 'Deslactosada', label: 'Leche deslactosada', price: 0.5 },
    { id: 'alm',   name: 'Almendra',     label: 'Leche de almendra',  price: 0.75 },
    { id: 'avena', name: 'Avena',        label: 'Leche de avena',     price: 1 },
  ];
  const TOPPINGS = [
    { id: 'vainilla',   name: 'Vainilla',   price: 0.5 },
    { id: 'lavanda',    name: 'Lavanda',    price: 0.6 },
    { id: 'piloncillo', name: 'Piloncillo', price: 0.4 },
  ];
  const allowsNoMilk = (id) => id === 'espresso' || id === 'americano';
  const hasTemp = (id) => id === 'latte' || id === 'americano';

  const METHODS = [
    { id: 'efectivo', name: 'Efectivo' },
    { id: 'tarjeta', name: 'Tarjeta' },
    { id: 'transfer', name: 'Transferencia' },
  ];
  const STATUS = {
    nueva: { name: 'Nueva', next: 'prep', action: 'Preparar' },
    prep: { name: 'Preparando', next: 'lista', action: 'Lista' },
    lista: { name: 'Lista', next: 'entregada', action: 'Entregada' },
    entregada: { name: 'Entregada', next: null, action: null },
  };
  const LATE_MIN = 10;
  const KEY = 'vr-comandera-v1';

  // ---- Utilidades ----
  const $ = (id) => document.getElementById(id);
  const by = (arr, id) => arr.find((x) => x.id === id);
  const money = (v) => '$' + (Math.round(v * 100) / 100).toFixed(2);
  const esc = (s) => String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const hhmm = (t) => new Date(t).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  const mins = (t) => Math.floor((Date.now() - t) / 60000);

  // ---- Ilustraciones de taza (mismas que la web) ----
  const CUP = {
    espresso:   { r: 24, c: '#7a4a32', a: '<circle cx="78" cy="58" r="12" fill="#9b6444" opacity=".7"/>' },
    americano:  { r: 32, c: '#5a3a2c', a: '<circle cx="78" cy="58" r="22" fill="#6b4535"/>' },
    latte:      { r: 32, c: '#d9a77c', a: '<path d="M78 76C50 59 61 40 78 52C95 40 106 59 78 76Z" fill="#fff6ee"/>' },
    cappuccino: { r: 32, c: '#fbeadb', a: '<circle cx="78" cy="58" r="22" fill="#f1d2b4"/><circle cx="67" cy="51" r="2" fill="#7a4a32"/><circle cx="84" cy="47" r="2" fill="#7a4a32"/><circle cx="91" cy="61" r="2" fill="#7a4a32"/><circle cx="71" cy="68" r="2" fill="#7a4a32"/>' },
    flat:       { r: 32, c: '#c99468', a: '<ellipse cx="78" cy="58" rx="21" ry="16" fill="#fff6ee"/><ellipse cx="78" cy="58" rx="10" ry="8" fill="#c99468"/>' },
  };
  const cup = (id) => {
    const c = CUP[id];
    return `<svg viewBox="0 0 156 116" aria-hidden="true"><circle cx="78" cy="58" r="52" fill="#f3ead8"/>
      <rect x="108" y="50" width="34" height="16" rx="8" fill="#fff" stroke="#e6dcc4" stroke-width="2"/>
      <circle cx="78" cy="58" r="${c.r + 7}" fill="#fff" stroke="#e6dcc4" stroke-width="2"/>
      <circle cx="78" cy="58" r="${c.r}" fill="${c.c}"/>${c.a}</svg>`;
  };

  // ---- Estado persistente ----
  const fresh = () => ({ day: today(), seq: 0, orders: [], history: [], settings: { tables: 8, products: [] } });
  let S;
  function load() {
    try { S = JSON.parse(localStorage.getItem(KEY)) || fresh(); } catch (e) { S = fresh(); }
    S.settings = Object.assign({ tables: 8, products: [] }, S.settings);
    S.orders = S.orders || [];
    S.history = S.history || [];
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('No se pudo guardar en este dispositivo'); }
  }
  load();

  // ---- Estado de la vista ----
  let view = 'pedido';
  const newCfg = () => ({ cafe: null, temp: 'hot', milk: 'desl', tops: [], qty: 1, note: '' });
  let cfg = newCfg();
  let draft = { dest: null, items: [], note: '' };
  let barraFilter = 'activas';
  let payKey = null;
  let pay = { method: 'efectivo', received: '', tip: 0 };

  // ---- Líneas ----
  const coffeeUnit = (c) => by(COFFEES, c.cafe).price + by(MILKS, c.milk).price + c.tops.reduce((s, t) => s + by(TOPPINGS, t).price, 0);
  function coffeeDesc(c) {
    const p = [];
    if (hasTemp(c.cafe)) p.push(c.temp === 'cold' ? 'Frío' : 'Caliente');
    if (c.milk !== 'none') p.push(by(MILKS, c.milk).label);
    c.tops.forEach((t) => p.push(by(TOPPINGS, t).name));
    return p.join(' · ');
  }
  const lineSig = (l) => [l.name, l.desc, l.note, l.unit].join('|');
  function addLine(line) {
    const same = draft.items.find((l) => lineSig(l) === lineSig(line));
    if (same) same.qty += line.qty; else draft.items.push(line);
    renderDraft();
  }
  const sum = (items) => items.reduce((s, l) => s + l.unit * l.qty, 0);
  const destLabel = (d) => (!d ? 'Sin destino' : d.type === 'mesa' ? 'Mesa ' + d.mesa : 'Llevar' + (d.name ? ' · ' + d.name : ''));
  const acctKey = (o) => (o.dest.type === 'mesa' ? 'mesa-' + o.dest.mesa : 'llevar-' + o.id);
  const unpaid = () => S.orders.filter((o) => !o.paid);
  const busyTables = () => new Set(unpaid().filter((o) => o.dest.type === 'mesa').map((o) => o.dest.mesa));

  // ---- Navegación ----
  function go(v) {
    view = v;
    document.querySelectorAll('.view').forEach((s) => { s.hidden = s.id !== 'v-' + v; });
    document.querySelectorAll('.tabs button').forEach((b) => {
      if (b.dataset.view === v) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    render();
    window.scrollTo(0, 0);
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-view]');
    if (b) go(b.dataset.view);
  });

  $('jump').addEventListener('click', () => document.querySelector('.ticket').scrollIntoView({ behavior: 'smooth' }));

  function render() {
    renderBadges();
    if (view !== 'pedido') $('jump').hidden = true;
    if (view === 'pedido') renderPedido();
    else if (view === 'barra') renderBarra();
    else if (view === 'cobro') renderCobro();
    else if (view === 'caja') renderCaja();
    else if (view === 'ajustes') renderAjustes();
  }
  function renderBadges() {
    const act = S.orders.filter((o) => o.status !== 'entregada').length;
    const acc = new Set(unpaid().map(acctKey)).size;
    $('b-barra').hidden = !act; $('b-barra').textContent = act;
    $('b-cobro').hidden = !acc; $('b-cobro').textContent = acc;
  }

  // ================= PEDIDO =================
  function renderPedido() {
    const d = draft.dest;
    const type = d ? d.type : 'mesa';
    $('dest-type').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.dt === type));
    $('dest-mesas').hidden = type !== 'mesa';
    $('dest-name').hidden = type !== 'llevar';
    const busy = busyTables();
    let h = '';
    for (let i = 1; i <= S.settings.tables; i++) {
      h += `<button type="button" class="mesa${busy.has(i) ? ' busy' : ''}" data-mesa="${i}" aria-pressed="${!!(d && d.type === 'mesa' && d.mesa === i)}" title="${busy.has(i) ? 'Mesa con cuenta abierta' : 'Mesa libre'}">${i}</button>`;
    }
    $('dest-mesas').innerHTML = h;

    $('coffees').innerHTML = COFFEES.map((c) => `
      <button type="button" class="coffee" data-cafe="${c.id}" aria-pressed="${cfg.cafe === c.id}">
        ${cup(c.id)}<b>${c.name}</b><span>${money(c.price)}</span></button>`).join('');
    renderCfg();

    const P = S.settings.products;
    $('prods').innerHTML = P.map((p) => `<button type="button" class="prod" data-prod="${p.id}"><b>${esc(p.name)}</b><span>${money(p.price)}</span></button>`).join('');
    $('prods').hidden = !P.length;
    $('prods-empty').hidden = !!P.length;
    renderDraft();
  }

  function renderCfg() {
    $('cfg').hidden = !cfg.cafe;
    if (!cfg.cafe) return;
    $('cfg-temp-row').hidden = !hasTemp(cfg.cafe);
    const chip = (attr, on, label, price) =>
      `<button type="button" class="chip" ${attr} aria-pressed="${on}">${label}${price != null ? `<small>${price ? '+' + money(price) : ''}</small>` : ''}</button>`;
    $('cfg-temp').innerHTML = chip('data-temp="hot"', cfg.temp === 'hot', 'Caliente') + chip('data-temp="cold"', cfg.temp === 'cold', 'Frío');
    $('cfg-milk').innerHTML = MILKS.filter((m) => m.id !== 'none' || allowsNoMilk(cfg.cafe))
      .map((m) => chip(`data-milk="${m.id}"`, cfg.milk === m.id, m.name, m.price)).join('');
    $('cfg-top').innerHTML = TOPPINGS.map((t) => chip(`data-top="${t.id}"`, cfg.tops.includes(t.id), t.name, t.price)).join('');
    $('cfg-qty').textContent = cfg.qty;
    $('cfg-total').textContent = money(coffeeUnit(cfg) * cfg.qty);
    if ($('cfg-note') !== document.activeElement) $('cfg-note').value = cfg.note;
  }

  function renderDraft() {
    const d = draft.dest;
    $('draft-dest').textContent = destLabel(d);
    $('draft-dest').classList.toggle('set', !!d);
    $('draft-lines').innerHTML = draft.items.map((l, i) => `
      <li><span class="q">${l.qty}×</span>
        <span><b>${esc(l.name)}</b>${l.desc ? `<br><span class="d">${esc(l.desc)}</span>` : ''}${l.note ? `<br><span class="n">${esc(l.note)}</span>` : ''}</span>
        <span class="p">${money(l.unit * l.qty)}</span>
        <span class="ctl"><button type="button" class="mini" data-dq="${i}" data-d="-1" aria-label="Quitar uno">−</button><button type="button" class="mini" data-dq="${i}" data-d="1" aria-label="Añadir uno">+</button></span>
      </li>`).join('');
    $('draft-empty').hidden = !!draft.items.length;
    $('draft-total').textContent = money(sum(draft.items));
    $('jump').hidden = view !== 'pedido' || !draft.items.length;
    $('jump-n').textContent = draft.items.reduce((s, l) => s + l.qty, 0) + ' prod.';
    $('jump-t').textContent = money(sum(draft.items));
    $('send').disabled = !draft.items.length || !d;
    $('send').textContent = d && d.type === 'mesa' && busyTables().has(d.mesa) ? 'Enviar ronda a barra' : 'Enviar a barra';
  }

  $('v-pedido').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const ds = b.dataset;
    if (ds.dt) {
      draft.dest = ds.dt === 'llevar' ? { type: 'llevar', name: $('in-name').value.trim() } : null;
      renderPedido();
      if (ds.dt === 'llevar') $('in-name').focus();
    } else if (ds.mesa) {
      draft.dest = { type: 'mesa', mesa: +ds.mesa };
      renderPedido();
    } else if (ds.cafe) {
      cfg = newCfg();
      cfg.cafe = ds.cafe;
      if (allowsNoMilk(ds.cafe)) cfg.milk = 'none';
      $('cfg-note').value = '';
      $('coffees').querySelectorAll('.coffee').forEach((x) => x.setAttribute('aria-pressed', x === b));
      renderCfg();
    } else if (ds.temp) { cfg.temp = ds.temp; renderCfg(); }
    else if (ds.milk) { cfg.milk = ds.milk; renderCfg(); }
    else if (ds.top) {
      cfg.tops = cfg.tops.includes(ds.top) ? cfg.tops.filter((t) => t !== ds.top) : cfg.tops.concat(ds.top);
      renderCfg();
    } else if (ds.q) { cfg.qty = Math.max(1, Math.min(20, cfg.qty + +ds.q)); renderCfg(); }
    else if (b.id === 'cfg-add') {
      const c = cfg;
      addLine({ kind: 'cafe', ref: c.cafe, name: by(COFFEES, c.cafe).name, desc: coffeeDesc(c), note: c.note.trim(), unit: coffeeUnit(c), qty: c.qty });
      toast(`${c.qty}× ${by(COFFEES, c.cafe).name} agregado`);
      cfg = newCfg();
      $('coffees').querySelectorAll('.coffee').forEach((x) => x.setAttribute('aria-pressed', 'false'));
      renderCfg();
    } else if (ds.prod) {
      const p = by(S.settings.products, ds.prod);
      if (p) addLine({ kind: 'prod', ref: p.id, name: p.name, desc: '', note: '', unit: p.price, qty: 1 });
    } else if (ds.dq != null) {
      const l = draft.items[+ds.dq];
      l.qty += +ds.d;
      if (l.qty < 1) draft.items.splice(+ds.dq, 1);
      renderDraft();
    } else if (b.id === 'clear') {
      if (draft.items.length && !confirm('¿Vaciar la comanda actual?')) return;
      draft = { dest: draft.dest, items: [], note: '' };
      $('in-note').value = '';
      renderDraft();
    } else if (b.id === 'send') sendDraft();
  });
  $('cfg-note').addEventListener('input', (e) => { cfg.note = e.target.value; });
  $('in-name').addEventListener('input', (e) => {
    if (draft.dest && draft.dest.type === 'llevar') { draft.dest.name = e.target.value.trim(); renderDraft(); }
  });

  function sendDraft() {
    if (!draft.items.length || !draft.dest) return;
    rollDay();
    const order = {
      id: uid(), folio: ++S.seq, dest: Object.assign({}, draft.dest), items: draft.items,
      note: $('in-note').value.trim(), status: 'nueva', created: Date.now(), updated: Date.now(), paid: false,
    };
    S.orders.push(order);
    save();
    toast(`Comanda #${order.folio} enviada · ${destLabel(order.dest)}`);
    draft = { dest: null, items: [], note: '' };
    $('in-note').value = '';
    $('in-name').value = '';
    renderPedido();
    renderBadges();
  }

  // ================= BARRA =================
  function renderBarra() {
    $('barra-filter').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.bf === barraFilter));
    const list = barraFilter === 'activas'
      ? S.orders.filter((o) => o.status !== 'entregada').sort((a, b) => a.created - b.created)
      : S.orders.filter((o) => o.status === 'entregada').sort((a, b) => b.updated - a.updated);
    $('board').innerHTML = list.map((o) => {
      const st = STATUS[o.status];
      const age = mins(o.created);
      const late = o.status !== 'entregada' && o.status !== 'lista' && age >= LATE_MIN;
      return `<article class="order ${o.status}${late ? ' late' : ''}">
        <div class="o-head">
          <div><div class="o-dest">${esc(destLabel(o.dest))}</div><div class="o-meta">#${o.folio} · ${hhmm(o.created)}</div></div>
          <span class="age">${o.status === 'entregada' ? hhmm(o.updated) : age + ' min'}</span>
        </div>
        <ul class="o-items">${o.items.map((l) => `<li><b>${l.qty}×</b><span>${esc(l.name)}</span>${l.desc ? `<span class="d">${esc(l.desc)}</span>` : ''}${l.note ? `<span class="n">⚠ ${esc(l.note)}</span>` : ''}</li>`).join('')}</ul>
        ${o.note ? `<div class="o-note">📝 ${esc(o.note)}</div>` : ''}
        <div class="o-status" style="color:var(--${o.status === 'entregada' ? 'soft' : o.status})">${st.name}</div>
        <div class="o-actions">
          ${o.status !== 'nueva' && o.status !== 'entregada' ? `<button type="button" class="btn btn-ghost btn-sm" data-back="${o.id}" aria-label="Regresar estado">↶</button>` : ''}
          ${st.next ? `<button type="button" class="btn btn-sm" data-adv="${o.id}">${st.action}</button>` : `<button type="button" class="btn btn-ghost btn-sm" data-back="${o.id}">Reabrir</button>`}
          ${o.status === 'nueva' && !o.paid ? `<button type="button" class="btn btn-ghost btn-sm danger" data-cancel="${o.id}" aria-label="Cancelar comanda">✕</button>` : ''}
        </div>
      </article>`;
    }).join('');
    $('board-empty').hidden = !!list.length;
    $('board-empty').textContent = barraFilter === 'activas' ? 'No hay comandas pendientes. ☕' : 'Todavía no se ha entregado nada hoy.';
  }
  $('v-barra').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const ds = b.dataset;
    if (ds.bf) { barraFilter = ds.bf; renderBarra(); return; }
    const id = ds.adv || ds.back || ds.cancel;
    const o = id && S.orders.find((x) => x.id === id);
    if (!o) return;
    if (ds.adv) o.status = STATUS[o.status].next;
    else if (ds.back) o.status = { prep: 'nueva', lista: 'prep', entregada: 'lista' }[o.status] || o.status;
    else if (ds.cancel) {
      if (!confirm(`¿Cancelar la comanda #${o.folio} (${destLabel(o.dest)})?`)) return;
      S.orders = S.orders.filter((x) => x !== o);
      toast(`Comanda #${o.folio} cancelada`);
    }
    o.updated = Date.now();
    save();
    render();
  });

  // ================= COBRO =================
  function accounts() {
    const map = new Map();
    unpaid().forEach((o) => {
      const k = acctKey(o);
      if (!map.has(k)) map.set(k, { key: k, dest: o.dest, orders: [] });
      map.get(k).orders.push(o);
    });
    return [...map.values()].map((a) => {
      const items = [];
      a.orders.forEach((o) => o.items.forEach((l) => {
        const same = items.find((x) => lineSig(x) === lineSig(l));
        if (same) same.qty += l.qty; else items.push(Object.assign({}, l));
      }));
      return Object.assign(a, {
        items, total: sum(items),
        since: Math.min(...a.orders.map((o) => o.created)),
        pending: a.orders.some((o) => o.status !== 'entregada'),
      });
    }).sort((x, y) => x.since - y.since);
  }

  function renderCobro() {
    const A = accounts();
    if (payKey && !A.find((a) => a.key === payKey)) payKey = null;
    $('accounts').innerHTML = A.map((a) => `
      <button type="button" class="acct" data-acct="${a.key}" aria-pressed="${a.key === payKey}">
        <b>${esc(destLabel(a.dest))}</b>
        <strong>${money(a.total)}</strong>
        <span>${a.orders.length} comanda${a.orders.length > 1 ? 's' : ''} · desde ${hhmm(a.since)}${a.pending ? ' · en barra' : ''}</span>
      </button>`).join('');
    $('accounts-empty').hidden = !!A.length;
    $('accounts').parentElement.hidden = !A.length;
    renderPay(A.find((a) => a.key === payKey));
  }

  function renderPay(a) {
    const el = $('pay');
    if (!a) { el.innerHTML = '<p class="soft">Selecciona una cuenta para cobrarla.</p>'; return; }
    const tip = Math.round(a.total * pay.tip) / 100;
    const grand = a.total + tip;
    const rec = parseFloat(pay.received);
    const change = pay.method === 'efectivo' && !isNaN(rec) ? rec - grand : null;
    const ok = pay.method !== 'efectivo' || (change != null && change >= -0.004);
    const quick = [...new Set([grand, Math.ceil(grand / 10) * 10, Math.ceil(grand / 20) * 20, Math.ceil(grand / 50) * 50, Math.ceil(grand / 100) * 100])];
    el.innerHTML = `
      <div class="ticket-head"><h2>${esc(destLabel(a.dest))}</h2><span class="pill">${a.orders.map((o) => '#' + o.folio).join(' ')}</span></div>
      <ul class="lines">${a.items.map((l) => `<li><span class="q">${l.qty}×</span><span><b>${esc(l.name)}</b>${l.desc ? `<br><span class="d">${esc(l.desc)}</span>` : ''}</span><span class="p">${money(l.unit * l.qty)}</span></li>`).join('')}</ul>
      <div class="total"><span>Subtotal</span><span>${money(a.total)}</span></div>
      <div class="tipline">${[0, 10, 15, 20].map((p) => `<button type="button" class="chip" data-tip="${p}" aria-pressed="${pay.tip === p}">${p ? 'Propina ' + p + '%' : 'Sin propina'}</button>`).join('')}</div>
      ${tip ? `<div class="total"><span>Propina</span><span>${money(tip)}</span></div>` : ''}
      <div class="total"><span>Total</span><strong>${money(grand)}</strong></div>
      <div class="methods">${METHODS.map((m) => `<button type="button" class="chip" data-method="${m.id}" aria-pressed="${pay.method === m.id}">${m.name}</button>`).join('')}</div>
      ${pay.method === 'efectivo' ? `
        <label class="field">Recibido
          <input type="number" id="in-rec" min="0" step="0.5" inputmode="decimal" value="${esc(pay.received)}" placeholder="${grand.toFixed(2)}">
        </label>
        <div class="quick">${quick.map((q) => `<button type="button" class="chip" data-rec="${q}">${money(q)}</button>`).join('')}</div>
        <div class="change${change != null && change < 0 ? ' neg' : ''}" id="change"><span>${change != null && change < 0 ? 'Falta' : 'Cambio'}</span><span>${change == null ? '—' : money(Math.abs(change))}</span></div>` : ''}
      ${a.pending ? '<p class="soft small">⚠ Hay productos que aún no se entregan.</p>' : ''}
      <button type="button" class="btn btn-block btn-lg" id="do-pay" ${ok ? '' : 'disabled'}>Cobrar ${money(grand)}</button>
      <button type="button" class="btn btn-ghost btn-block" id="pre-print">Imprimir cuenta</button>`;
    const inp = $('in-rec');
    if (inp) inp.addEventListener('input', () => { pay.received = inp.value; updateChange(a); });
  }
  function updateChange(a) {
    const grand = a.total + Math.round(a.total * pay.tip) / 100;
    const rec = parseFloat(pay.received);
    const change = isNaN(rec) ? null : rec - grand;
    const el = $('change');
    el.classList.toggle('neg', change != null && change < 0);
    el.innerHTML = `<span>${change != null && change < 0 ? 'Falta' : 'Cambio'}</span><span>${change == null ? '—' : money(Math.abs(change))}</span>`;
    $('do-pay').disabled = !(change != null && change >= -0.004);
  }

  $('v-cobro').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const ds = b.dataset;
    const a = accounts().find((x) => x.key === (ds.acct || payKey));
    if (ds.acct) { payKey = ds.acct; pay = { method: 'efectivo', received: '', tip: 0 }; renderCobro(); return; }
    if (!a) return;
    if (ds.method) { pay.method = ds.method; renderPay(a); }
    else if (ds.tip != null) { pay.tip = +ds.tip; renderPay(a); }
    else if (ds.rec) { pay.received = (+ds.rec).toFixed(2); renderPay(a); }
    else if (b.id === 'pre-print') printTicket(a, null);
    else if (b.id === 'do-pay') doPay(a);
  });

  function doPay(a) {
    const tip = Math.round(a.total * pay.tip) / 100;
    const grand = a.total + tip;
    const rec = pay.method === 'efectivo' ? (parseFloat(pay.received) || grand) : grand;
    const payment = { method: pay.method, subtotal: a.total, tip, total: grand, received: rec, change: Math.max(0, rec - grand), at: Date.now() };
    a.orders.forEach((o) => { o.paid = true; o.payment = Object.assign({ group: a.key + '-' + payment.at }, payment); });
    save();
    toast(`Cobrado ${money(grand)} · ${by(METHODS, pay.method).name}${payment.change ? ' · Cambio ' + money(payment.change) : ''}`);
    const done = a;
    payKey = null;
    pay = { method: 'efectivo', received: '', tip: 0 };
    render();
    if (confirm('¿Imprimir ticket?')) printTicket(done, payment);
  }

  function printTicket(a, p) {
    const r = (l, rr, cls) => `<p class="r${cls ? ' ' + cls : ''}"><span>${l}</span><span>${rr}</span></p>`;
    $('print').innerHTML = `
      <h3>Villa Rústica</h3><p class="c">Café y panadería artesanal</p><hr>
      ${r(esc(destLabel(a.dest)), a.orders.map((o) => '#' + o.folio).join(' '))}
      <p>${new Date(p ? p.at : Date.now()).toLocaleString('es-MX')}</p><hr>
      ${a.items.map((l) => r(l.qty + ' ' + esc(l.name), money(l.unit * l.qty)) + (l.desc ? `<p class="sm">${esc(l.desc)}</p>` : '')).join('')}
      <hr>${r('Subtotal', money(a.total))}
      ${p && p.tip ? r('Propina', money(p.tip)) : ''}
      ${r('TOTAL', money(p ? p.total : a.total), 'big')}
      ${p ? r(by(METHODS, p.method).name, money(p.received)) + (p.change ? r('Cambio', money(p.change)) : '') : '<p class="c">— Cuenta, no es comprobante de pago —</p>'}
      <hr><p class="c">¡Gracias por tu visita!</p>`;
    window.print();
  }

  // ================= CAJA =================
  function payments(orders) {
    const g = new Map();
    orders.filter((o) => o.paid).forEach((o) => {
      const k = o.payment.group;
      if (!g.has(k)) g.set(k, Object.assign({ dest: o.dest, folios: [] }, o.payment));
      g.get(k).folios.push(o.folio);
    });
    return [...g.values()].sort((a, b) => b.at - a.at);
  }
  function summary(orders) {
    const P = payments(orders);
    const by_m = {};
    METHODS.forEach((m) => { by_m[m.id] = 0; });
    let sales = 0, tips = 0;
    P.forEach((p) => { sales += p.subtotal; tips += p.tip; by_m[p.method] += p.total; });
    const prods = {};
    orders.filter((o) => o.paid).forEach((o) => o.items.forEach((l) => {
      prods[l.name] = prods[l.name] || { qty: 0, amt: 0 };
      prods[l.name].qty += l.qty; prods[l.name].amt += l.qty * l.unit;
    }));
    return { P, sales, tips, by_m, tickets: P.length, avg: P.length ? sales / P.length : 0, prods, open: sum([].concat(...orders.filter((o) => !o.paid).map((o) => o.items))) };
  }

  function renderCaja() {
    const s = summary(S.orders);
    const k = (l, v) => `<div class="kpi"><span>${l}</span><strong>${v}</strong></div>`;
    $('kpis').innerHTML = k('Ventas cobradas', money(s.sales)) + k('Tickets', s.tickets) + k('Ticket promedio', money(s.avg)) +
      k('Propinas', money(s.tips)) + METHODS.map((m) => k(m.name, money(s.by_m[m.id]))).join('') + k('Por cobrar', money(s.open));
    const top = Object.entries(s.prods).sort((a, b) => b[1].qty - a[1].qty).slice(0, 10);
    $('top').innerHTML = top.length ? top.map(([n, v]) => `<li>${esc(n)} <span>${v.qty} · ${money(v.amt)}</span></li>`).join('') : '<p class="soft">Sin ventas todavía.</p>';
    $('sales').innerHTML = s.P.length ? s.P.map((p) => `<div class="sale"><span>${hhmm(p.at)}</span><span>${esc(destLabel(p.dest))} <span class="soft">#${p.folios.join(' #')}</span></span><span class="m">${by(METHODS, p.method).name}</span><b>${money(p.total)}</b></div>`).join('') : '<p class="soft">Sin cobros todavía.</p>';
    $('hist-card').hidden = !S.history.length;
    $('hist').innerHTML = S.history.slice().reverse().map((h) => `<div class="hist-row"><span>${h.day}</span><span>${h.tickets} tickets</span><b>${money(h.sales)}</b></div>`).join('');
  }

  $('csv').addEventListener('click', () => {
    const rows = [['folio', 'hora_pedido', 'destino', 'producto', 'detalle', 'cantidad', 'precio_unitario', 'importe', 'pagado', 'metodo', 'hora_cobro']];
    S.orders.forEach((o) => o.items.forEach((l) => rows.push([
      o.folio, hhmm(o.created), destLabel(o.dest), l.name, l.desc + (l.note ? ' (' + l.note + ')' : ''), l.qty, l.unit.toFixed(2), (l.unit * l.qty).toFixed(2),
      o.paid ? 'sí' : 'no', o.paid ? by(METHODS, o.payment.method).name : '', o.paid ? hhmm(o.payment.at) : '',
    ])));
    const csv = rows.map((r) => r.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `villa-rustica-ventas-${S.day}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  function closeDay() {
    const s = summary(S.orders);
    S.history.push({ day: S.day, sales: s.sales, tips: s.tips, tickets: s.tickets, by_m: s.by_m });
    S.history = S.history.slice(-60);
    S.orders = S.orders.filter((o) => !o.paid); // las cuentas abiertas pasan al día siguiente
    S.seq = 0;
    S.day = today();
    save();
  }
  $('close-day').addEventListener('click', () => {
    const open = unpaid().length;
    const msg = '¿Cerrar el día? Se guardará el resumen y se reiniciarán los folios.' + (open ? `\n\nHay ${open} comanda(s) sin cobrar: se conservarán.` : '');
    if (!confirm(msg)) return;
    closeDay();
    toast('Día cerrado');
    render();
  });
  // Si la app se abre un día nuevo con ventas del anterior, se cierra el día automáticamente.
  function rollDay() {
    if (S.day !== today() && S.orders.some((o) => o.paid)) closeDay();
    else if (S.day !== today() && !S.orders.length) { S.day = today(); S.seq = 0; }
  }

  // ================= AJUSTES =================
  function renderAjustes() {
    $('in-tables').value = S.settings.tables;
    $('plist').innerHTML = S.settings.products.map((p) => `<li><b>${esc(p.name)}</b><span>${money(p.price)}</span><button type="button" class="mini" data-del="${p.id}" aria-label="Eliminar ${esc(p.name)}">✕</button></li>`).join('') || '<li class="soft">Sin productos extra.</li>';
    $('carta').innerHTML = COFFEES.map((c) => `<div class="carta-row"><span>${c.name}</span><span>${money(c.price)}</span></div>`).join('') +
      '<p class="soft small" style="margin-top:.6rem">Leches: ' + MILKS.filter((m) => m.price).map((m) => m.name + ' +' + money(m.price)).join(', ') +
      '. Toppings: ' + TOPPINGS.map((t) => t.name + ' +' + money(t.price)).join(', ') + '.</p>';
  }
  $('in-tables').addEventListener('change', (e) => {
    const n = Math.max(1, Math.min(60, parseInt(e.target.value, 10) || 1));
    S.settings.tables = n; e.target.value = n; save(); toast(`${n} mesas`);
  });
  $('prod-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('pf-name').value.trim();
    const price = parseFloat($('pf-price').value);
    if (!name || isNaN(price) || price < 0) return;
    S.settings.products.push({ id: uid(), name, price: Math.round(price * 100) / 100 });
    save();
    $('pf-name').value = ''; $('pf-price').value = ''; $('pf-name').focus();
    renderAjustes();
  });
  $('plist').addEventListener('click', (e) => {
    const b = e.target.closest('[data-del]');
    if (!b) return;
    S.settings.products = S.settings.products.filter((p) => p.id !== b.dataset.del);
    save(); renderAjustes();
  });
  $('reset').addEventListener('click', () => {
    if (!confirm('Esto borra comandas, ventas, historial y productos de este dispositivo. ¿Continuar?')) return;
    if (!confirm('¿Seguro? No se puede deshacer.')) return;
    S = fresh(); save(); draft = { dest: null, items: [], note: '' }; toast('Datos borrados'); render();
  });

  // ---- Sonido para comandas nuevas en barra ----
  let AC;
  function chime() {
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      const t = AC.currentTime;
      [880, 1175].forEach((f, i) => {
        const o = AC.createOscillator(), g = AC.createGain(), b = t + i * 0.14;
        o.frequency.value = f; g.gain.setValueAtTime(0.0001, b);
        g.gain.exponentialRampToValueAtTime(0.25, b + 0.02); g.gain.exponentialRampToValueAtTime(0.001, b + 0.5);
        o.connect(g); g.connect(AC.destination); o.start(b); o.stop(b + 0.55);
      });
    } catch (e) { /* sin audio */ }
  }

  // ---- Sincronización entre pestañas ----
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return;
    const before = new Set(S.orders.map((o) => o.id));
    load();
    if (view === 'barra' && S.orders.some((o) => !before.has(o.id))) chime();
    render();
  });

  // ---- Toast y reloj ----
  let tt;
  function toast(msg) {
    const el = $('toast');
    el.textContent = msg; el.classList.add('show');
    clearTimeout(tt); tt = setTimeout(() => el.classList.remove('show'), 2600);
  }
  function tick() {
    $('clock').textContent = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    if (view === 'barra') renderBarra();
  }
  setInterval(tick, 30000);

  rollDay();
  save();
  tick();
  const start = (location.hash || '').slice(1);
  go(['pedido', 'barra', 'cobro', 'caja', 'ajustes'].includes(start) ? start : 'pedido');
})();
