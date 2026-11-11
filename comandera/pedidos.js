// Tablet 2 · Pedidos (junto a la cafetera). Pedidos de la web y del mostrador.
(() => {
  'use strict';
  const { $, by, esc, money } = VR;
  const MIN = 60000;
  const ATENUAR = 30 * MIN; // atenuado si faltan más de 30 min
  const TARDE = 30 * MIN;   // rojo 30 min después de la hora de recogida

  let area = 'cafe';
  let vistaCafe = 'activos';
  let verEntregadosPan = false;
  try { area = sessionStorage.getItem('vr-ped-area') || 'cafe'; } catch (e) { /* */ }

  const ESTADO = { nuevo: 'Nuevo', espera: 'Esperando respuesta', aceptado: 'En preparación', listo: 'Listo', entregado: 'Entregado', perdido: 'Perdido' };
  const MOTIVOS = [
    { id: 'leche', name: 'Cambiar el tipo de leche' },
    { id: 'topping', name: 'Topping agotado' },
    { id: 'disponibilidad', name: 'Sin disponibilidad por el momento' },
    { id: 'otro', name: 'Otro' },
  ];

  function setArea(a) {
    area = a;
    try { sessionStorage.setItem('vr-ped-area', a); } catch (e) { /* */ }
    document.body.dataset.area = a;
    render();
  }

  function render() {
    const nCafe = VR.S.cafe.filter((o) => o.estado === 'nuevo').length;
    const nPan = VR.S.pan.filter((o) => o.estado === 'nuevo').length;
    VR.areaTabs($('area-tab'), area, setArea, { cafe: nCafe, pan: nPan });
    $('reloj').textContent = VR.hora(Date.now());
    if (area === 'cafe') renderCafe(); else renderPan();
  }

  // ================= CAFETERÍA =================
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const vivo = (o) => ['nuevo', 'espera', 'aceptado', 'listo'].includes(o.estado);
  function renderCafe() {
    $('titulo').textContent = 'Cafetería';
    const hoy = VR.dayKey();
    const perdidos = VR.S.cafe.filter((o) => o.estado === 'perdido');
    const entregados = VR.S.cafe.filter((o) => o.estado === 'entregado' && VR.dayKey(o.entregado || o.creado) === hoy);
    const activos = VR.S.cafe.filter(vivo);
    $('vista').innerHTML = [['activos', `Activos · ${activos.length}`], ['perdidos', `Pedidos perdidos · ${perdidos.length}`], ['entregados', `Entregados hoy · ${entregados.length}`]]
      .map(([k, l]) => `<button type="button" data-vista="${k}" aria-pressed="${vistaCafe === k}">${l}</button>`).join('');
    $('vista').hidden = false;

    let list;
    if (vistaCafe === 'activos') {
      list = activos.sort((a, b) => (a.estado === 'espera') !== (b.estado === 'espera') ? (a.estado === 'espera' ? -1 : 1) : a.hora - b.hora);
    } else if (vistaCafe === 'perdidos') list = perdidos.sort((a, b) => (b.perdido || 0) - (a.perdido || 0));
    else list = entregados.sort((a, b) => b.entregado - a.entregado);

    if (!list.length) {
      $('contenido').innerHTML = `<div class="vacio"><h3>${vistaCafe === 'activos' ? 'Todo al día ☕' : 'Nada por aquí'}</h3>${vistaCafe === 'activos' ? 'Cuando llegue un pedido sonará un aviso.' : ''}</div>`;
      return;
    }
    $('contenido').innerHTML = `<div class="lista">${list.map(cardCafe).join('')}</div>`;
  }

  function cardCafe(o) {
    const now = Date.now();
    const web = o.origen === 'web';
    const tarde = web && vivo(o) && now > o.hora + TARDE;
    const dim = vivo(o) && o.estado !== 'espera' && o.hora - now > ATENUAR;
    const cls = ['ped', o.estado, tarde ? 'tarde' : '', dim ? 'dim' : ''].join(' ');
    const falta = Math.round((o.hora - now) / MIN);
    const horaTxt = web ? VR.hora(o.hora) : 'Ahora';
    const sub = !web ? 'mostrador' : !vivo(o) ? '' : falta > 0 ? `en ${falta} min` : falta === 0 ? 'ya' : `hace ${-falta} min`;
    const total = VR.sum(o.items);
    let acc = '';
    if (o.estado === 'nuevo') acc = `<button class="btn ghost" data-a="rechazar" data-id="${o.id}">Rechazar</button><button class="btn" data-a="aceptar" data-id="${o.id}">Aceptar</button>`;
    else if (o.estado === 'espera') acc = `<button class="btn ghost sm" data-a="perder" data-id="${o.id}">A perdidos</button><button class="btn" data-a="editar" data-id="${o.id}">Editar y aceptar</button>`;
    else if (o.estado === 'aceptado') acc = `<button class="btn" data-a="listo" data-id="${o.id}">Marcar listo</button>`;
    else if (o.estado === 'listo') acc = (web ? `<button class="btn ghost sm" data-a="perder" data-id="${o.id}">A perdidos</button>` : '') + `<button class="btn" data-a="entregar" data-id="${o.id}">${o.pago ? 'Entregado' : 'Cobrar y entregar'}</button>`;
    else if (o.estado === 'perdido') acc = `<button class="btn ghost sm" data-a="recuperar" data-id="${o.id}">Regresar a activos</button>`;
    return `<article class="${cls}">
      <div class="ped-top">
        <div><div class="ped-nombre">${esc(o.cliente)}</div>
          <div class="ped-meta"><span class="tag ${o.origen}">${web ? 'Web' : 'Mostrador'}</span> <span class="tag estado">${tarde ? 'No ha llegado' : ESTADO[o.estado]}</span> · #${o.folio}</div></div>
        <div class="ped-hora">${horaTxt}<small>${sub}</small></div>
      </div>
      <ul class="ped-items">${o.items.map((l) => `<li><span class="q">${l.qty}×</span><b>${esc(l.name)}</b>${l.desc ? `<span class="d">${esc(l.desc)}</span>` : ''}</li>`).join('')}</ul>
      ${o.estado === 'espera' ? `<div class="motivo">💬 ${esc(o.motivo || '')} · mensaje enviado ${VR.hora(o.esperaDesde)}</div>` : ''}
      ${tarde ? `<div class="tarde-msg">Pasaron más de 30 min de su hora de recogida.</div>` : ''}
      <div class="ped-pie"><span class="tot">${money(total)}</span>${o.pago ? `<span class="pagado">Pagado · ${o.pago.metodo === 'efectivo' ? 'Efectivo' : 'Tarjeta'}</span>` : '<span>Paga al recoger</span>'}</div>
      ${acc ? `<div class="ped-acc">${acc}</div>` : ''}
    </article>`;
  }

  const findCafe = (id) => VR.S.cafe.find((o) => o.id === id);
  function accionCafe(a, o) {
    if (a === 'aceptar') {
      o.estado = 'aceptado'; o.aceptado = Date.now(); VR.save(); render();
      if (o.origen === 'web') VR.wa(o.tel, VR.MSG.cafeAceptado(o));
    } else if (a === 'listo') {
      o.estado = 'listo'; o.listo = Date.now(); VR.save(); render();
      if (o.origen === 'web') VR.wa(o.tel, VR.MSG.cafeListo(o));
      else VR.toast(`Llama a ${o.cliente}: su café está listo`);
    } else if (a === 'entregar') {
      const fin = () => { o.estado = 'entregado'; o.entregado = Date.now(); VR.save(); render(); VR.toast(`#${o.folio} ${o.cliente} entregado`); };
      if (o.pago) fin();
      else VR.cobro(VR.sum(o.items), `Cobrar a ${esc(o.cliente)}`, (pago) => { o.pago = pago; fin(); });
    } else if (a === 'rechazar') rechazar(o);
    else if (a === 'editar') editar(o);
    else if (a === 'perder') {
      VR.confirmar(`¿Mandar el pedido de ${esc(o.cliente)} a Pedidos perdidos?\nNo se cobra.`, 'Mandar a perdidos', () => {
        o.estadoPrevio = o.estado; o.estado = 'perdido'; o.perdido = Date.now(); VR.save(); render();
      });
    } else if (a === 'recuperar') { o.estado = o.estadoPrevio || 'espera'; VR.save(); render(); }
  }

  function rechazar(o) {
    let motivo = null;
    const m = VR.modal(`<h2 class="m-title">Rechazar · ${esc(o.cliente)}</h2>
      <p class="hint">Elige el motivo. El mensaje se puede ajustar antes de enviarlo.</p>
      <div class="chips" id="motivos">${MOTIVOS.map((x) => `<button class="chip" data-mot="${x.id}">${x.name}</button>`).join('')}</div>
      <textarea id="msg" placeholder="Elige un motivo"></textarea>
      <div class="m-actions"><button class="btn ghost" data-close>Volver</button><button class="btn wa" id="enviar" disabled>Enviar por WhatsApp</button></div>`);
    const msg = m.el.querySelector('#msg'), env = m.el.querySelector('#enviar');
    m.el.querySelector('#motivos').onclick = (e) => {
      const b = e.target.closest('[data-mot]');
      if (!b) return;
      motivo = by(MOTIVOS, b.dataset.mot);
      m.el.querySelectorAll('[data-mot]').forEach((x) => x.setAttribute('aria-pressed', x === b));
      msg.value = VR.MSG.cafeRechazo(o, motivo.id);
      env.disabled = false; msg.focus();
    };
    env.onclick = () => {
      o.estado = 'espera'; o.motivo = motivo.name; o.esperaDesde = Date.now(); o.mensaje = msg.value;
      VR.save(); m.close(); render();
      VR.wa(o.tel, msg.value);
    };
  }

  function editar(o) {
    let items = o.items.map((l) => Object.assign({}, l, { tops: l.tops.slice() }));
    let idx = null; // índice que se está cambiando
    const m = VR.modal(`<h2 class="m-title">Editar pedido · ${esc(o.cliente)}</h2>
      <p class="motivo">💬 ${esc(o.motivo || '')}</p>
      <ul class="lines" id="e-lines"></ul>
      <p class="lbl" id="e-lbl"></p>
      <div id="e-builder"></div>
      <div class="total-row"><span>Total nuevo</span><strong id="e-total"></strong></div>
      <div class="m-actions"><button class="btn ghost" data-close>Volver</button><button class="btn" id="e-ok">Aceptar pedido</button></div>`, { wide: true });
    const el = m.el;
    let bld;
    function mount() {
      const host = el.querySelector('#e-builder');
      const fresh = host.cloneNode(false); host.replaceWith(fresh);
      const init = idx != null ? { cafe: items[idx].cafe, temp: items[idx].temp, milk: items[idx].milk, tops: items[idx].tops, qty: items[idx].qty } : null;
      bld = VR.coffeeBuilder(fresh, (line) => {
        if (idx != null) items[idx] = line; else items.push(line);
        idx = null; mount(); paint();
      }, init ? { initial: init, addLabel: 'Guardar cambio' } : { addLabel: 'Agregar café' });
      el.querySelector('#e-lbl').textContent = idx != null ? `Cambiando: ${items[idx].name}` : 'Agregar otro café';
    }
    function paint() {
      el.querySelector('#e-lines').innerHTML = items.map((l, i) => `<li${i === idx ? ' style="background:var(--acento-claro)"' : ''}><span class="q">${l.qty}×</span><span><b>${esc(l.name)}</b><span class="d">${esc(l.desc)}</span></span><span class="p">${money(l.unit * l.qty)}</span>
        <span class="x" style="display:flex;gap:14px"><button class="x" data-ed="${i}">Cambiar</button><button class="x" data-rm="${i}">Quitar</button></span></li>`).join('');
      el.querySelector('#e-total').textContent = money(VR.sum(items));
      el.querySelector('#e-ok').disabled = !items.length;
    }
    el.querySelector('#e-lines').onclick = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.ed != null) { idx = +b.dataset.ed; mount(); paint(); }
      if (b.dataset.rm != null) { items.splice(+b.dataset.rm, 1); idx = null; mount(); paint(); }
    };
    el.querySelector('#e-ok').onclick = () => {
      o.items = items; o.estado = 'aceptado'; o.aceptado = Date.now(); o.editado = true;
      VR.save(); m.close(); render();
      VR.wa(o.tel, VR.MSG.cafeAceptado(o));
    };
    idx = items.length === 1 ? 0 : null;
    mount(); paint();
  }

  // ================= PANADERÍA =================
  function renderPan() {
    $('titulo').textContent = 'Panadería';
    $('vista').innerHTML = `<button type="button" data-verent="0" aria-pressed="${!verEntregadosPan}">Por entregar</button><button type="button" data-verent="1" aria-pressed="${verEntregadosPan}">Incluir entregados</button>`;
    const hoy = VR.dayKey();
    const list = VR.S.pan.filter((o) => o.tipo !== 'vitrina' && o.estado !== 'cancelado' && (verEntregadosPan || o.estado !== 'entregado'));
    if (!list.length) { $('contenido').innerHTML = '<div class="vacio"><h3>Sin pedidos de pan</h3>Cuando llegue un pedido de restaurante o Canasta aparecerá aquí, agrupado por día de entrega.</div>'; return; }
    const dias = [...new Set(list.map((o) => o.fecha))].sort();
    $('contenido').innerHTML = dias.map((f) => {
      const del = list.filter((o) => o.fecha === f);
      const pend = del.filter((o) => o.estado !== 'entregado');
      const atrasado = f < hoy && pend.length;
      const piezas = {};
      pend.forEach((o) => o.items.forEach((l) => { piezas[l.name] = (piezas[l.name] || 0) + l.qty; }));
      const etiqueta = atrasado ? 'Atrasado' : f === hoy ? 'Hoy' : f === VR.addDays(hoy, 1) ? 'Mañana' : '';
      const zonas = [['Mexicali', (o) => o.entrega === 'entrega' && o.ciudad === 'Mexicali'], ['San Luis', (o) => o.entrega === 'entrega' && o.ciudad === 'San Luis'], ['Pick up', (o) => o.entrega === 'pickup']];
      return `<section class="dia${atrasado ? ' atrasado' : ''}">
        <div class="dia-head"><h2>${etiqueta ? `<small>${etiqueta}</small>` : ''}${cap(VR.fechaLarga(f))}</h2>
          <div class="hornear">${Object.keys(piezas).length ? '<span class="lbl">Hornear:</span>' + Object.entries(piezas).sort((a, b) => b[1] - a[1]).map(([n, q]) => `<span class="tag">${q} ${esc(n)}</span>`).join('') : '<span class="lbl">Todo entregado</span>'}</div></div>
        ${zonas.map(([z, fn]) => { const os = del.filter(fn); return os.length ? `<p class="zona">${z} · ${os.length}</p><div class="lista">${os.map(cardPan).join('')}</div>` : ''; }).join('')}
      </section>`;
    }).join('');
  }

  function cardPan(o) {
    const t = VR.breadTotals(o);
    let acc = '';
    if (o.estado === 'nuevo') acc = `<button class="btn" data-p="aceptar" data-id="${o.id}">Aceptar y confirmar</button>`;
    else if (o.estado === 'aceptado') acc = `<button class="btn ghost sm" data-p="reenviar" data-id="${o.id}">💬 Reenviar</button><button class="btn" data-p="entregar" data-id="${o.id}">Cobrar y entregar</button>`;
    return `<article class="ped pan ${o.estado}">
      <div class="ped-top">
        <div><div class="ped-nombre">${esc(o.cliente)}</div>
          <div class="ped-meta"><span class="tag">${o.tipo === 'restaurante' ? 'Restaurante' : 'Canasta'}</span> <span class="tag ${o.origen}">${o.origen === 'web' ? 'Web' : 'Mostrador'}</span> <span class="tag estado">${o.estado === 'nuevo' ? 'Nuevo' : o.estado === 'aceptado' ? 'Aceptado' : 'Entregado'}</span> · #${o.folio}</div></div>
      </div>
      <ul class="ped-items">${o.items.map((l) => `<li><span class="q">${l.qty}×</span><b>${esc(l.name)}</b>${o.tipo === 'restaurante' && VR.docenas(l.qty) ? `<span class="d">${VR.docenas(l.qty)}</span>` : ''}</li>`).join('')}</ul>
      <div class="ped-meta">📞 ${esc(o.tel)}</div>
      <div class="ped-pie"><span class="tot">${money(t.total)}</span>${o.pago ? `<span class="pagado">Pagado · ${o.pago.metodo === 'efectivo' ? 'Efectivo' : 'Tarjeta'}</span>` : `<span>Paga al ${o.entrega === 'entrega' ? 'recibir' : 'recoger'}${t.comision ? ' · incl. 10% envío' : ''}</span>`}</div>
      ${acc ? `<div class="ped-acc">${acc}</div>` : ''}
    </article>`;
  }

  function accionPan(a, o) {
    if (a === 'aceptar') { o.estado = 'aceptado'; o.aceptado = Date.now(); VR.save(); render(); VR.wa(o.tel, VR.MSG.pan(o)); }
    else if (a === 'reenviar') VR.wa(o.tel, VR.MSG.pan(o));
    else if (a === 'entregar') {
      VR.cobro(VR.breadTotals(o).total, `Cobrar a ${esc(o.cliente)}`, (pago) => {
        o.pago = pago; o.estado = 'entregado'; o.entregado = Date.now(); VR.save(); render(); VR.toast(`Pedido de ${o.cliente} entregado`);
      });
    }
  }

  // ---------- Eventos ----------
  document.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const d = b.dataset;
    if (d.vista) { vistaCafe = d.vista; render(); }
    else if (d.verent) { verEntregadosPan = d.verent === '1'; render(); }
    else if (d.a) { const o = findCafe(d.id); if (o) accionCafe(d.a, o); }
    else if (d.p) { const o = VR.S.pan.find((x) => x.id === d.id); if (o) accionPan(d.p, o); }
    else if (d.demo) {
      const o = d.demo === 'pan' ? VR.demoPan() : VR.demoCafe(d.demo === 'cafe-tarde' ? 120 : null);
      avisar(d.demo === 'pan' ? 'pan' : 'cafe', o);
    }
  });

  function avisar(kind, o) {
    VR.sound(kind);
    VR.toast(kind === 'pan' ? `🥖 Nuevo pedido de pan: ${o.cliente}` : `☕ Nuevo pedido: ${o.cliente}`);
    render();
  }

  // Llegan pedidos desde la otra tablet o (en la versión final) desde Supabase
  VR.onChange((prev) => {
    const nc = VR.S.cafe.filter((o) => !prev.cafe.has(o.id));
    const np = VR.S.pan.filter((o) => !prev.pan.has(o.id) && o.tipo !== 'vitrina');
    if (np.length) avisar('pan', np[0]);
    else if (nc.length) avisar('cafe', nc[0]);
    else render();
  });

  $('activar').onclick = () => { VR.audio(); VR.sound('cafe'); $('sonido').hidden = true; };

  // Primera vez: algunos pedidos de ejemplo para ver cómo luce
  if (!VR.S.settings.sembrado) {
    VR.S.settings.sembrado = true;
    [8, 20, 75].forEach((m) => VR.demoCafe(m));
    for (let i = 0; i < 4; i++) VR.demoPan();
    VR.save();
  }

  setInterval(render, 30000);
  setArea(area);
})();
