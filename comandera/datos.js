// Villa Rústica · Comandera — núcleo compartido por las dos tablets y la administración.
// PROTOTIPO: los datos viven en este dispositivo (localStorage) y se sincronizan entre
// pestañas/ventanas del mismo equipo. En la versión final esta capa se cambia por Supabase.
const VR = (() => {
  'use strict';

  // En línea: hay configuración de Supabase y la librería cargó. Con ?demo en la dirección se usa el modo demostración.
  const ONLINE = !!(window.VR_CONFIG && window.VR_CONFIG.url && window.VR_CONFIG.key) && !/[?&]demo\b/.test(location.search);
  const KEY = ONLINE ? 'vr-comandera-nube-v1' : 'vr-comandera-v3';
  const TZ = 'America/Hermosillo';

  // ---------- Catálogo de ejemplo (precios de prueba, se editan en Administración) ----------
  const DEMO_CATALOG = {
    coffees: [
      { id: 'espresso',   name: 'Espresso',   price: 40, agotado: false },
      { id: 'americano',  name: 'Americano',  price: 45, agotado: false },
      { id: 'cappuccino', name: 'Cappuccino', price: 55, agotado: false },
      { id: 'flat',       name: 'Flat white', price: 60, agotado: false },
      { id: 'latte',      name: 'Latte',      price: 60, agotado: false },
    ],
    milks: [
      { id: 'none',  name: 'Sin leche',    label: 'sin leche',          price: 0,  agotado: false },
      { id: 'entera', name: 'Entera',      label: 'leche entera',       price: 0,  agotado: false },
      { id: 'desl',  name: 'Deslactosada', label: 'leche deslactosada', price: 10, agotado: false },
      { id: 'alm',   name: 'Almendra',     label: 'leche de almendra',  price: 15, agotado: false },
      { id: 'avena', name: 'Avena',        label: 'leche de avena',     price: 15, agotado: false },
    ],
    toppings: [
      { id: 'vainilla',   name: 'Vainilla',   price: 10, agotado: false },
      { id: 'lavanda',    name: 'Lavanda',    price: 12, agotado: false },
      { id: 'piloncillo', name: 'Piloncillo', price: 8,  agotado: false },
    ],
    // Mismos panes y precios que la app "La Villa Rústica Pedidos"
    breads: [
      { id: 'baguette',   name: 'Baguette',                  pieza: 60,  docena: 700,  agotado: false },
      { id: 'baguetteFr', name: 'Baguette estándar francés', pieza: 140, docena: 1599, agotado: false },
      { id: 'campesino',  name: 'Campesino',                 pieza: 150, docena: 1759, agotado: false },
      { id: 'barra',      name: 'Barra artesana',            pieza: 90,  docena: 999,  agotado: false },
      { id: 'centeno',    name: 'Pan de centeno',            pieza: 99,  docena: 1099, agotado: false },
    ],
  };

  const clone = (x) => JSON.parse(JSON.stringify(x));
  const fresh = () => ({ catalog: clone(DEMO_CATALOG), cafe: [], pan: [], seq: {}, settings: { pin: '1234', adminPass: 'villa' } });

  // ---------- Estado y sincronización ----------
  let S;
  function load() {
    try { S = JSON.parse(localStorage.getItem(KEY)) || fresh(); } catch (e) { S = fresh(); }
    const f = fresh();
    S.catalog = S.catalog || f.catalog; S.cafe = S.cafe || []; S.pan = S.pan || [];
    S.seq = S.seq || {}; S.settings = Object.assign(f.settings, S.settings);
  }
  load();

  const bc = 'BroadcastChannel' in window ? new BroadcastChannel(KEY) : null;
  const listeners = [];
  const saveHooks = [];
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('No se pudo guardar'); }
    if (bc) bc.postMessage('cambio');
    saveHooks.forEach((fn) => fn());
  }
  const onSave = (fn) => saveHooks.push(fn);
  // Reemplaza los pedidos con los del servidor y avisa a la pantalla (para el sonido de pedidos nuevos).
  function setData(cafe, pan, silencioso) {
    const prev = { cafe: new Set(S.cafe.map((o) => o.id)), pan: new Set(S.pan.map((o) => o.id)) };
    S.cafe = cafe; S.pan = pan;
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* solo caché */ }
    const p = silencioso ? { cafe: new Set(cafe.map((o) => o.id)), pan: new Set(pan.map((o) => o.id)) } : prev;
    listeners.forEach((fn) => fn(p));
  }
  function changed() {
    const prev = { cafe: new Set(S.cafe.map((o) => o.id)), pan: new Set(S.pan.map((o) => o.id)) };
    load();
    listeners.forEach((fn) => fn(prev));
  }
  if (bc) bc.onmessage = changed;
  window.addEventListener('storage', (e) => { if (e.key === KEY) changed(); });
  const onChange = (fn) => listeners.push(fn);

  // ---------- Utilidades ----------
  const $ = (id) => document.getElementById(id);
  const by = (arr, id) => arr.find((x) => x.id === id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const uid = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 7));
  const money = (v) => '$' + (Math.round(v * 100) / 100).toLocaleString('es-MX', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });
  const hora = (ts) => new Intl.DateTimeFormat('es-MX', { hour: 'numeric', minute: '2-digit', hourCycle: 'h23', timeZone: TZ }).format(ts).replace(/^0(\d)/, '$1');
  const dayKey = (ts) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ts == null ? Date.now() : ts);
  const keyDate = (k) => new Date(k + 'T12:00:00Z');
  const addDays = (k, n) => { const d = keyDate(k); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const fechaLarga = (k) => new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(keyDate(k));
  const fechaCorta = (k) => new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(keyDate(k)).replace(/\./g, '');
  const dow = (k) => keyDate(k).getUTCDay();
  const pad = (n) => String(n).padStart(2, '0');

  function folio(area) {
    const k = area + dayKey();
    S.seq[k] = (S.seq[k] || 0) + 1;
    return S.seq[k];
  }

  // ---------- Café ----------
  const allowsNoMilk = (id) => id === 'espresso' || id === 'americano';
  const hasTemp = (id) => id === 'latte' || id === 'americano';
  function coffeeUnit(c) {
    const C = S.catalog;
    return (by(C.coffees, c.cafe) || { price: 0 }).price + (by(C.milks, c.milk) || { price: 0 }).price + c.tops.reduce((s, t) => s + (by(C.toppings, t) || { price: 0 }).price, 0);
  }
  function coffeeDesc(c) {
    const C = S.catalog, p = [];
    if (hasTemp(c.cafe)) p.push(c.temp === 'cold' ? 'Frío' : 'Caliente');
    if (c.milk !== 'none' && by(C.milks, c.milk)) p.push(cap(by(C.milks, c.milk).label));
    c.tops.forEach((t) => p.push(by(C.toppings, t) ? by(C.toppings, t).name : t));
    return p.join(' · ');
  }
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  // "Latte frío con leche de avena y lavanda"
  function coffeePhrase(c, withQty) {
    const C = S.catalog;
    let s = by(C.coffees, c.cafe) ? by(C.coffees, c.cafe).name : (c.name || c.cafe);
    if (hasTemp(c.cafe) && c.temp === 'cold') s += ' frío';
    const leche = by(C.milks, c.milk);
    if (c.milk !== 'none' && leche) s += ' con ' + leche.label;
    if (c.tops.length) s += (c.milk !== 'none' && leche ? ' y ' : ' con ') + c.tops.map((t) => (by(C.toppings, t) ? by(C.toppings, t).name : t).toLowerCase()).join(' y ');
    return (withQty && c.qty > 1 ? c.qty + ' ' : '') + s;
  }
  // Congela nombre, descripción y precio al momento del pedido.
  function coffeeLine(c) {
    const cafe = by(S.catalog.coffees, c.cafe);
    return { cafe: c.cafe, temp: c.temp, milk: c.milk, tops: c.tops.slice(), qty: c.qty, name: cafe ? cafe.name : (c.name || c.cafe), desc: coffeeDesc(c), unit: coffeeUnit(c) };
  }
  const sum = (items) => items.reduce((s, l) => s + l.unit * l.qty, 0);
  const lista = (arr) => (arr.length < 2 ? arr.join('') : arr.slice(0, -1).join(', ') + ' y ' + arr[arr.length - 1]);

  // ---------- Pan ----------
  const ZONAS = { Mexicali: [1, 4], 'San Luis': [2, 5] }; // lunes/jueves · martes/viernes
  // Cada docena completa de un mismo pan se cobra a precio de docena (igual que la app de pedidos).
  function breadLineTotal(tipo, b, qty) {
    return Math.floor(qty / 12) * b.docena + (qty % 12) * b.pieza;
  }
  function breadTotals(o) {
    // Pedidos del servidor: se respeta lo que calculó (comisión por código postal).
    if (o.totalServidor != null) return { sub: o.subtotalServidor, comision: o.comisionServidor || 0, total: o.totalServidor };
    const sub = o.items.reduce((s, l) => s + l.importe, 0);
    const comision = o.tipo === 'canasta' && o.entrega === 'entrega' && o.ciudad === 'San Luis' ? Math.round(sub * 0.10 * 100) / 100 : 0;
    return { sub, comision, total: sub + comision };
  }
  function breadLines(tipo, qtys) {
    return Object.keys(qtys).filter((id) => qtys[id] > 0).map((id) => {
      const b = by(S.catalog.breads, id);
      return { pan: id, name: b.name, qty: qtys[id], importe: breadLineTotal(tipo, b, qtys[id]) };
    });
  }
  // Próximas fechas válidas con 48 h de anticipación (contadas por días).
  function fechasValidas(entrega, ciudad, n) {
    const out = [];
    let k = addDays(dayKey(), 2);
    for (let i = 0; i < 40 && out.length < (n || 6); i++, k = addDays(k, 1)) {
      const d = dow(k);
      if (entrega === 'pickup' ? d >= 1 && d <= 6 : (ZONAS[ciudad] || []).includes(d)) out.push(k);
    }
    return out;
  }
  const docenas = (q) => {
    const d = Math.floor(q / 12), r = q % 12;
    if (!d) return '';
    return d + (d === 1 ? ' docena' : ' docenas') + (r ? ' + ' + r + (r === 1 ? ' pieza' : ' piezas') : '');
  };

  // ---------- WhatsApp ----------
  // Muestra el mensaje ya escrito y un botón que abre WhatsApp con él.
  // Si el cliente no dejó celular (en pan es opcional), ofrece su correo.
  function wa(tel, text, email) {
    let d = String(tel || '').replace(/\D/g, '');
    if (d.length === 10) d = '52' + d;
    if (d.length < 10) {
      const asunto = 'Tu pedido en Villa Rústica';
      return modal(`<h2 class="m-title">Sin celular</h2>
        <p class="hint">${email ? 'Este cliente no dejó celular. Mándale el mensaje a su correo: <b class="sel">' + esc(email) + '</b>' : 'Este cliente no dejó celular ni correo.'}</p>
        <div class="wa-burbuja correo">${esc(text)}</div>
        <div class="m-actions"><button class="btn ghost" data-close>Cerrar</button>${email ? `<a class="btn" href="mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(text)}" data-close>Escribir correo</a>` : ''}</div>`);
    }
    const url = 'https://wa.me/' + d + '?text=' + encodeURIComponent(text);
    return modal(`<h2 class="m-title">Mensaje por WhatsApp</h2>
      <p class="hint">Para ${esc(tel)}</p>
      <div class="wa-burbuja">${esc(text)}</div>
      <div class="m-actions"><button class="btn ghost" data-close>Ahora no</button><a class="btn wa" href="${url}" target="_blank" rel="noopener" data-close>Enviar por WhatsApp</a></div>`);
  }
  const first = (n) => String(n || '').trim().split(/\s+/)[0] || '';
  const MSG = {
    cafeAceptado: (o) => `¡Hola, ${first(o.cliente)}! ☕ Recibimos tu pedido: ${lista(o.items.map((c) => coffeePhrase(c, true)))}, para las ${hora(o.hora)}. Ya lo estamos preparando. — Villa Rústica`,
    cafeListo: (o) => `¡${first(o.cliente)}, tu café ya está listo! 🌿 Pasa por él cuando gustes. Total a pagar: ${money(sum(o.items))}. Te esperamos.`,
    cafeRechazo(o, motivo) {
      const C = S.catalog, n = first(o.cliente), h = hora(o.hora);
      const conLeche = o.items.find((c) => c.milk !== 'none');
      const conTop = o.items.find((c) => c.tops.length);
      if (motivo === 'leche' && conLeche) {
        const alt = C.milks.find((m) => m.id !== 'none' && m.id !== conLeche.milk && !m.agotado);
        return `Hola, ${n} 🌾 Hoy se nos terminó la ${by(C.milks, conLeche.milk).label}. ¿Te preparamos tu ${by(C.coffees, conLeche.cafe).name.toLowerCase()} con ${alt ? alt.label : 'otra leche'}? Respóndenos y lo tenemos listo para las ${h}.`;
      }
      if (motivo === 'topping' && conTop) {
        const t = by(C.toppings, conTop.tops[0]);
        return `Hola, ${n} 🌾 Hoy se nos terminó el topping de ${t.name.toLowerCase()}. ¿Te preparamos tu ${by(C.coffees, conTop.cafe).name.toLowerCase()} sin ${t.name.toLowerCase()}? Respóndenos y lo tenemos listo para las ${h}.`;
      }
      if (motivo === 'disponibilidad') return `Hola, ${n} 🌾 Por el momento no tenemos disponibilidad para preparar tu pedido de las ${h}. ¿Te lo podemos tener un poco más tarde? Respóndenos y te confirmamos.`;
      return `Hola, ${n} 🌾 Sobre tu pedido de las ${h}: `;
    },
    pan(o) {
      const t = breadTotals(o).total;
      const f = fechaLarga(o.fecha);
      const lugar = o.ciudad === 'San Luis' ? 'San Luis Río Colorado' : o.ciudad;
      if (o.tipo === 'restaurante') {
        return [
          `Buen día, ${o.cliente}. Confirmamos su pedido en Villa Rústica:`,
          ...o.items.map((l) => `• ${l.qty} ${l.name}${docenas(l.qty) ? ' (' + docenas(l.qty) + ')' : ''}`),
          o.entrega === 'entrega'
            ? `Entrega: ${f}, ${lugar}. Le confirmaremos la hora de entrega por este medio.`
            : `Recoger: ${f}, de 10:00 a 17:00, en Villa Rústica.`,
          `Total a pagar al ${o.entrega === 'entrega' ? 'recibir' : 'recoger'}: ${money(t)} (efectivo).`,
          'Gracias por su preferencia.',
        ].join('\n');
      }
      return [
        `Hola, ${first(o.cliente)}. Confirmamos tu Canasta de pan:`,
        '• ' + o.items.map((l) => `${l.qty} ${l.name}`).join(', '),
        o.entrega === 'entrega'
          ? `Entrega: ${f}, ${lugar}. Te confirmaremos la hora por este medio.`
          : `Recoger: ${f}, de 10:00 a 17:00, en Villa Rústica.`,
        `Total a pagar al ${o.entrega === 'entrega' ? 'recibir' : 'recoger'}: ${money(t)}${breadTotals(o).comision ? ' (incluye 10% de envío)' : ''}.`,
        '¡Gracias!',
      ].join('\n');
    },
  };

  // ---------- Sonidos ----------
  let AC = null;
  function audio() {
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      if (AC.state === 'suspended') AC.resume();
    } catch (e) { AC = null; }
    return AC;
  }
  const audioReady = () => !!AC && AC.state === 'running';
  function sound(kind) {
    const a = audio();
    if (!a) return;
    const notes = kind === 'pan' ? [523, 659, 784, 1047] : kind === 'tap' ? [660] : [988, 1319, 988, 1319];
    const t = a.currentTime;
    notes.forEach((f, i) => {
      const o = a.createOscillator(), g = a.createGain(), b = t + i * (kind === 'tap' ? 0 : 0.16);
      o.type = kind === 'pan' ? 'triangle' : 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, b);
      g.gain.exponentialRampToValueAtTime(kind === 'tap' ? 0.08 : 0.3, b + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, b + (kind === 'tap' ? 0.08 : 0.55));
      o.connect(g); g.connect(a.destination); o.start(b); o.stop(b + 0.6);
    });
  }

  // ---------- Interfaz compartida ----------
  let tt;
  function toast(msg) {
    let el = $('toast');
    if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = msg; el.classList.add('show');
    clearTimeout(tt); tt = setTimeout(() => el.classList.remove('show'), 2800);
  }

  function modal(html, opts) {
    const wrap = document.createElement('div');
    wrap.className = 'modal-bg';
    wrap.innerHTML = `<div class="modal ${opts && opts.wide ? 'wide' : ''}" role="dialog" aria-modal="true">${html}</div>`;
    document.body.appendChild(wrap);
    const close = () => wrap.remove();
    wrap.addEventListener('click', (e) => {
      if (e.target === wrap && !(opts && opts.sticky)) close();
      if (e.target.closest('[data-close]')) close();
    });
    return { el: wrap.firstElementChild, close };
  }

  function confirmar(texto, si, cb, peligro) {
    const m = modal(`<p class="m-text">${texto}</p><div class="m-actions"><button class="btn ghost" data-close>Volver</button><button class="btn ${peligro ? 'danger' : ''}" data-ok>${si}</button></div>`);
    m.el.querySelector('[data-ok]').onclick = () => { m.close(); cb(); };
  }

  // PIN de 4 dígitos del barista
  function pin(titulo, cb) {
    let v = '';
    const m = modal(`<h2 class="m-title">${titulo || 'PIN del barista'}</h2>
      <div class="pin-dots">${'<span></span>'.repeat(4)}</div>
      <div class="pin-pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-n="${n}">${n}</button>`).join('')}<button data-close class="muted-key">Salir</button><button data-n="0">0</button><button data-del class="muted-key">⌫</button></div>`);
    const dots = m.el.querySelectorAll('.pin-dots span');
    const paint = () => dots.forEach((d, i) => d.classList.toggle('on', i < v.length));
    m.el.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.n) v += b.dataset.n; else if (b.hasAttribute('data-del')) v = v.slice(0, -1);
      paint();
      if (v.length === 4) {
        if (v === S.settings.pin) { m.close(); cb(); }
        else { m.el.querySelector('.pin-dots').classList.add('shake'); setTimeout(() => { v = ''; paint(); m.el.querySelector('.pin-dots').classList.remove('shake'); }, 450); }
      }
    });
  }

  // Cobro: efectivo con cálculo de cambio o tarjeta en terminal
  function cobro(total, titulo, cb) {
    let metodo = 'efectivo', recibido = null;
    const billetes = [...new Set([total, ...[50, 100, 200, 500, 1000].map((b) => Math.ceil(total / b) * b)])].filter((x) => x >= total).slice(0, 5);
    const m = modal(`
      <h2 class="m-title">${titulo}</h2>
      <div class="cobro-total"><span>Total</span><strong>${money(total)}</strong></div>
      <div class="seg wide" role="group"><button data-m="efectivo">Efectivo</button><button data-m="tarjeta">Tarjeta</button></div>
      <div class="cobro-body"></div>
      <div class="m-actions"><button class="btn ghost" data-close>Cancelar</button><button class="btn" data-ok>Confirmar cobro</button></div>`);
    const body = m.el.querySelector('.cobro-body');
    const ok = m.el.querySelector('[data-ok]');
    function paint() {
      m.el.querySelectorAll('[data-m]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.m === metodo));
      if (metodo === 'tarjeta') {
        body.innerHTML = '<p class="hint">Cobra <b>' + money(total) + '</b> en la terminal y confirma cuando salga aprobado.</p>';
        ok.disabled = false; return;
      }
      const cambio = recibido == null ? null : recibido - total;
      body.innerHTML = `<p class="lbl">¿Con cuánto paga?</p>
        <div class="billetes">${billetes.map((b) => `<button class="chip" data-b="${b}" aria-pressed="${recibido === b}">${b === total ? 'Exacto' : money(b)}</button>`).join('')}</div>
        <input type="number" inputmode="decimal" min="0" step="1" class="input" id="rec" placeholder="Otra cantidad" value="${recibido != null && !billetes.includes(recibido) ? recibido : ''}">
        <div class="cambio ${cambio != null && cambio < 0 ? 'neg' : ''}"><span>${cambio != null && cambio < 0 ? 'Falta' : 'Cambio'}</span><strong>${cambio == null ? '—' : money(Math.abs(cambio))}</strong></div>`;
      ok.disabled = !(cambio != null && cambio >= 0);
      const inp = body.querySelector('#rec');
      inp.oninput = () => {
        recibido = inp.value === '' ? null : parseFloat(inp.value);
        const c = recibido == null ? null : recibido - total;
        const box = body.querySelector('.cambio');
        box.classList.toggle('neg', c != null && c < 0);
        box.innerHTML = `<span>${c != null && c < 0 ? 'Falta' : 'Cambio'}</span><strong>${c == null ? '—' : money(Math.abs(c))}</strong>`;
        body.querySelectorAll('[data-b]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
        ok.disabled = !(c != null && c >= 0);
      };
    }
    m.el.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.m) { metodo = b.dataset.m; paint(); }
      else if (b.dataset.b) { recibido = +b.dataset.b; paint(); }
    });
    ok.onclick = () => {
      const pago = { metodo, total, recibido: metodo === 'efectivo' ? recibido : total, cambio: metodo === 'efectivo' ? recibido - total : 0, at: Date.now() };
      m.close();
      cb(pago);
    };
    paint();
  }

  // ---------- Ilustraciones ----------
  const CUP = {
    espresso:   { r: 24, c: '#7a4a32', a: '<circle cx="78" cy="58" r="12" fill="#9b6444" opacity=".7"/>' },
    americano:  { r: 32, c: '#5a3a2c', a: '<circle cx="78" cy="58" r="22" fill="#6b4535"/>' },
    latte:      { r: 32, c: '#d9a77c', a: '<path d="M78 76C50 59 61 40 78 52C95 40 106 59 78 76Z" fill="#fff6ee"/>' },
    cappuccino: { r: 32, c: '#fbeadb', a: '<circle cx="78" cy="58" r="22" fill="#f1d2b4"/><circle cx="67" cy="51" r="2" fill="#7a4a32"/><circle cx="84" cy="47" r="2" fill="#7a4a32"/><circle cx="91" cy="61" r="2" fill="#7a4a32"/><circle cx="71" cy="68" r="2" fill="#7a4a32"/>' },
    flat:       { r: 32, c: '#c99468', a: '<ellipse cx="78" cy="58" rx="21" ry="16" fill="#fff6ee"/><ellipse cx="78" cy="58" rx="10" ry="8" fill="#c99468"/>' },
  };
  const cup = (id) => {
    const c = CUP[id] || CUP.americano;
    return `<svg viewBox="0 0 156 116" aria-hidden="true"><circle cx="78" cy="58" r="52" fill="#efe5d3"/>
      <rect x="108" y="50" width="34" height="16" rx="8" fill="#fff" stroke="#e6dcc4" stroke-width="2"/>
      <circle cx="78" cy="58" r="${c.r + 7}" fill="#fff" stroke="#e6dcc4" stroke-width="2"/>
      <circle cx="78" cy="58" r="${c.r}" fill="${c.c}"/>${c.a}</svg>`;
  };
  // Ilustraciones de pan: las mismas de la app "La Villa Rústica Pedidos".
  function breadArt(id, w) {
    w = w || 84;
    const crust = '#B9844A', dark = '#8E5E2E', light = '#E3B97A', score = '#F2D7A6';
    const s = {
      baguette: `<svg viewBox="0 0 120 50" width="${w}" aria-hidden="true"><rect x="6" y="14" width="108" height="22" rx="11" fill="${crust}" transform="rotate(-8 60 25)"/><g stroke="${score}" stroke-width="3" stroke-linecap="round" transform="rotate(-8 60 25)"><path d="M24 20l10 10M44 20l10 10M64 20l10 10M84 20l10 10"/></g></svg>`,
      baguetteFr: `<svg viewBox="0 0 120 50" width="${w}" aria-hidden="true"><rect x="2" y="18" width="116" height="15" rx="7.5" fill="${dark}" transform="rotate(-10 60 25)"/><g stroke="${light}" stroke-width="2.4" stroke-linecap="round" transform="rotate(-10 60 25)"><path d="M14 22l7 7M28 22l7 7M42 22l7 7M56 22l7 7M70 22l7 7M84 22l7 7M98 22l7 7"/></g></svg>`,
      campesino: `<svg viewBox="0 0 120 70" width="${w}" aria-hidden="true"><ellipse cx="60" cy="38" rx="44" ry="28" fill="${crust}"/><ellipse cx="60" cy="34" rx="38" ry="22" fill="${light}" opacity=".35"/><path d="M42 26l36 22M78 26L42 48" stroke="${score}" stroke-width="3.5" stroke-linecap="round"/></svg>`,
      barra: `<svg viewBox="0 0 120 60" width="${w}" aria-hidden="true"><ellipse cx="60" cy="32" rx="52" ry="20" fill="${crust}"/><path d="M22 34 Q60 14 98 30" stroke="${score}" stroke-width="4" fill="none" stroke-linecap="round"/></svg>`,
      centeno: `<svg viewBox="0 0 120 70" width="${w}" aria-hidden="true"><ellipse cx="60" cy="38" rx="42" ry="27" fill="#6B4A2E"/><g fill="#EFE6D6" opacity=".7"><circle cx="44" cy="30" r="1.6"/><circle cx="56" cy="24" r="1.4"/><circle cx="70" cy="28" r="1.8"/><circle cx="80" cy="38" r="1.4"/><circle cx="50" cy="44" r="1.5"/><circle cx="64" cy="46" r="1.3"/><circle cx="38" cy="40" r="1.2"/></g><path d="M40 36h40" stroke="#C9A77C" stroke-width="2.5" stroke-linecap="round"/></svg>`,
    };
    // Panes nuevos agregados en Administración usan la hogaza genérica.
    return s[id] || s.campesino;
  }

  // ---------- Armador de café (el mismo sistema que la web) ----------
  // el: contenedor · onAdd(line) · opts.initial · opts.addLabel
  function coffeeBuilder(el, onAdd, opts) {
    opts = opts || {};
    const blank = () => ({ cafe: null, temp: 'hot', milk: 'entera', tops: [], qty: 1 });
    let sel = opts.initial ? clone(opts.initial) : blank();
    function render() {
      const C = S.catalog;
      const chip = (attr, on, label, price, off) =>
        `<button type="button" class="chip" ${attr} aria-pressed="${on}" ${off ? 'disabled' : ''}>${label}${off ? '<small>agotado</small>' : price ? `<small>+${money(price)}</small>` : ''}</button>`;
      let h = `<div class="coffees">${C.coffees.map((c) => `
        <button type="button" class="coffee" data-cafe="${c.id}" aria-pressed="${sel.cafe === c.id}" ${c.agotado ? 'disabled' : ''}>
          ${cup(c.id)}<b>${esc(c.name)}</b><span>${c.agotado ? 'Agotado' : money(c.price)}</span></button>`).join('')}</div>`;
      if (sel.cafe) {
        h += `<div class="cfg">
          ${hasTemp(sel.cafe) ? `<div class="cfg-row"><span class="lbl">Temperatura</span><div class="chips">${chip('data-temp="hot"', sel.temp === 'hot', 'Caliente')}${chip('data-temp="cold"', sel.temp === 'cold', 'Frío')}</div></div>` : ''}
          <div class="cfg-row"><span class="lbl">Leche</span><div class="chips">${C.milks.filter((m) => m.id !== 'none' || allowsNoMilk(sel.cafe)).map((m) => chip(`data-milk="${m.id}"`, sel.milk === m.id, m.name, m.price, m.agotado)).join('')}</div></div>
          <div class="cfg-row"><span class="lbl">Toppings</span><div class="chips">${C.toppings.map((t) => chip(`data-top="${t.id}"`, sel.tops.includes(t.id), t.name, t.price, t.agotado)).join('')}</div></div>
          <div class="cfg-row add"><div class="stepper"><button type="button" data-q="-1" aria-label="Menos">−</button><output>${sel.qty}</output><button type="button" data-q="1" aria-label="Más">+</button></div>
          <button type="button" class="btn" data-add>${opts.addLabel || 'Agregar'} · ${money(coffeeUnit(sel) * sel.qty)}</button></div>
        </div>`;
      }
      el.innerHTML = h;
    }
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || b.disabled) return;
      const d = b.dataset;
      if (d.cafe) {
        const keep = sel.cafe ? sel : null;
        sel = blank(); sel.cafe = d.cafe;
        if (keep) { sel.milk = keep.milk; sel.tops = keep.tops; sel.temp = keep.temp; }
        if (allowsNoMilk(d.cafe) && !keep) sel.milk = 'none';
        if (sel.milk === 'none' && !allowsNoMilk(d.cafe)) sel.milk = 'entera';
        const m = by(S.catalog.milks, sel.milk);
        if (m && m.agotado) { const alt = S.catalog.milks.find((x) => !x.agotado && (x.id !== 'none' || allowsNoMilk(d.cafe))); sel.milk = alt ? alt.id : sel.milk; }
        sel.tops = sel.tops.filter((t) => !by(S.catalog.toppings, t).agotado);
      } else if (d.temp) sel.temp = d.temp;
      else if (d.milk) sel.milk = d.milk;
      else if (d.top) sel.tops = sel.tops.includes(d.top) ? sel.tops.filter((t) => t !== d.top) : sel.tops.concat(d.top);
      else if (d.q) sel.qty = Math.max(1, Math.min(20, sel.qty + +d.q));
      else if (b.hasAttribute('data-add')) { onAdd(coffeeLine(sel)); if (!opts.initial) sel = blank(); }
      else return;
      sound('tap');
      render();
    });
    render();
    return { render, reset() { sel = blank(); render(); } };
  }

  // Pestañita de la esquina Cafetería / Panadería
  function areaTabs(el, area, onPick, badges) {
    el.innerHTML = ['cafe', 'pan'].map((a) => `<button type="button" data-area="${a}" aria-pressed="${a === area}">${a === 'cafe' ? 'Cafetería' : 'Panadería'}${badges && badges[a] ? `<span class="badge">${badges[a]}</span>` : ''}</button>`).join('');
    el.onclick = (e) => { const b = e.target.closest('[data-area]'); if (b) onPick(b.dataset.area); };
  }

  // ---------- Pedidos de demostración (simulan los que llegan de la web) ----------
  const NOMBRES = ['María', 'Ana Sofía', 'Valeria', 'Fernanda', 'Lucía', 'Daniela', 'Paola', 'Regina', 'Camila', 'Mariana'];
  const RESTAURANTES = ['Restaurante La Terraza', 'Cocina Delta', 'Bistró del Río', 'Casa Mar de Cortés', 'Asador Norteño'];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  function demoCafe(minutos) {
    const C = S.catalog, items = [];
    const n = Math.random() < 0.7 ? 1 : 2;
    for (let i = 0; i < n; i++) {
      const c = pick(C.coffees.filter((x) => !x.agotado)).id;
      const milks = C.milks.filter((m) => (m.id !== 'none' || allowsNoMilk(c)));
      items.push(coffeeLine({ cafe: c, temp: Math.random() < 0.3 ? 'cold' : 'hot', milk: pick(milks).id, tops: Math.random() < 0.4 ? [pick(C.toppings).id] : [], qty: 1 }));
    }
    const mins = minutos != null ? minutos : pick([10, 15, 20, 25, 45, 90]);
    const t = Math.ceil((Date.now() + mins * 60000) / 300000) * 300000;
    const o = { id: uid(), folio: folio('cafe'), origen: 'web', cliente: pick(NOMBRES), tel: '653' + (1000000 + Math.floor(Math.random() * 8999999)), items, hora: t, estado: 'nuevo', creado: Date.now(), pago: null };
    S.cafe.push(o); save(); return o;
  }
  function demoPan() {
    const C = S.catalog;
    const tipo = Math.random() < 0.6 ? 'restaurante' : 'canasta';
    const qtys = {};
    if (tipo === 'restaurante') {
      const k = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < k; i++) qtys[pick(C.breads).id] = 12 * (1 + Math.floor(Math.random() * 3));
    } else {
      for (let i = 0; i < 2; i++) qtys[pick(C.breads).id] = 1 + Math.floor(Math.random() * 4);
    }
    const entrega = tipo === 'restaurante' ? 'entrega' : Math.random() < 0.5 ? 'pickup' : 'entrega';
    const ciudad = entrega === 'pickup' ? null : tipo === 'canasta' ? 'San Luis' : pick(['Mexicali', 'San Luis']);
    const fechas = fechasValidas(entrega, ciudad, 4);
    const o = { id: uid(), folio: folio('pan'), origen: 'web', tipo, cliente: tipo === 'restaurante' ? pick(RESTAURANTES) : pick(NOMBRES), tel: '686' + (1000000 + Math.floor(Math.random() * 8999999)), items: breadLines(tipo, qtys), entrega, ciudad, fecha: pick(fechas.slice(0, 3)), estado: 'nuevo', creado: Date.now(), pago: null };
    S.pan.push(o); save(); return o;
  }

  function reset() { S = fresh(); save(); }

  return {
    get S() { return S; }, save, onChange, onSave, setData, online: ONLINE, reset, folio, uid,
    $, by, esc, money, hora, dayKey, addDays, fechaLarga, fechaCorta, pad, first,
    allowsNoMilk, hasTemp, coffeeUnit, coffeeDesc, coffeePhrase, coffeeLine, sum,
    breadLineTotal, breadTotals, breadLines, fechasValidas, docenas, ZONAS,
    wa, MSG, sound, audio, audioReady,
    toast, modal, confirmar, pin, cobro, cup, breadArt, coffeeBuilder, areaTabs,
    demoCafe, demoPan,
  };
})();
