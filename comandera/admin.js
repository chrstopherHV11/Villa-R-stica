// Administración (solo el dueño): corte de caja, menú y precios, pedidos de pan, ajustes.
(() => {
  'use strict';
  const { $, esc, money } = VR;

  let tab = 'corte';
  let dia = VR.dayKey();
  let dentro = false;
  try { dentro = sessionStorage.getItem('vr-admin') === '1'; } catch (e) { /* */ }

  $('login-form').onsubmit = (e) => {
    e.preventDefault();
    if ($('pass').value === VR.S.settings.adminPass) { dentro = true; try { sessionStorage.setItem('vr-admin', '1'); } catch (er) { /* */ } abrir(); }
    else { VR.toast('Contraseña incorrecta'); $('pass').select(); }
  };
  $('salir').onclick = () => { try { sessionStorage.removeItem('vr-admin'); } catch (e) { /* */ } location.reload(); };
  $('tabs').onclick = (e) => { const b = e.target.closest('[data-tab]'); if (b) { tab = b.dataset.tab; render(); } };

  function abrir() { $('login').hidden = true; $('app').hidden = false; render(); }

  function render() {
    $('tabs').querySelectorAll('button').forEach((b) => { if (b.dataset.tab === tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    ({ corte, menu, pan: pedidosPan, ajustes })[tab]();
  }

  // ================= CORTE DE CAJA =================
  function corte() {
    const S = VR.S;
    const todos = [...S.cafe.map((o) => Object.assign({ area: 'cafe' }, o)), ...S.pan.map((o) => Object.assign({ area: 'pan' }, o))];
    const cobrados = todos.filter((o) => o.pago && VR.dayKey(o.pago.at) === dia && o.estado !== 'cancelado');
    const cancel = todos.filter((o) => o.cancelacion && VR.dayKey(o.cancelacion.at) === dia);
    const perdidos = S.cafe.filter((o) => o.estado === 'perdido' && VR.dayKey(o.perdido) === dia);
    const cafesDia = S.cafe.filter((o) => VR.dayKey(o.creado) === dia && o.estado !== 'cancelado');
    const t = (arr) => arr.reduce((s, o) => s + o.pago.total, 0);
    const cafe = cobrados.filter((o) => o.area === 'cafe'), pan = cobrados.filter((o) => o.area === 'pan');
    const ef = cobrados.filter((o) => o.pago.metodo === 'efectivo'), tj = cobrados.filter((o) => o.pago.metodo === 'tarjeta');
    const k = (l, v, sub) => `<div class="card kpi"><span>${l}</span><strong>${v}</strong>${sub ? `<em>${sub}</em>` : ''}</div>`;

    const top = {};
    cobrados.forEach((o) => o.items.forEach((l) => { const n = (o.area === 'cafe' ? '☕ ' : '🥖 ') + l.name; top[n] = top[n] || { q: 0, $: 0 }; top[n].q += l.qty; top[n].$ += o.area === 'cafe' ? l.unit * l.qty : l.importe; }));
    const topRows = Object.entries(top).sort((a, b) => b[1].q - a[1].q).slice(0, 10);

    $('vista').innerHTML = `
      <div class="ped-head"><h1>Corte de caja</h1>
        <div style="display:flex;gap:8px;align-items:center" class="no-print"><input type="date" id="dia" value="${dia}" style="width:auto"><button class="btn ghost sm" id="imprimir">Imprimir</button></div></div>
      <p class="hint" style="margin-top:-6px">${VR.fechaLarga(dia).replace(/^./, (x) => x.toUpperCase())}</p>
      <div class="kpis">
        ${k('Total vendido', money(t(cobrados)), cobrados.length + ' cobros')}
        ${k('Cafetería', money(t(cafe)), cafe.length + ' cobros')}
        ${k('Panadería', money(t(pan)), pan.length + ' cobros')}
        ${k('Efectivo', money(t(ef)), 'debe haber en caja')}
        ${k('Tarjeta', money(t(tj)), 'debe cuadrar con la terminal')}
        ${k('Cancelaciones', cancel.length, money(cancel.reduce((s, o) => s + o.cancelacion.monto, 0)) + ' devuelto')}
      </div>
      <div class="kpis">
        ${k('Pedidos de café web', cafesDia.filter((o) => o.origen === 'web').length)}
        ${k('Pedidos de café mostrador', cafesDia.filter((o) => o.origen === 'mostrador').length)}
        ${k('Pedidos perdidos', perdidos.length, perdidos.length ? money(perdidos.reduce((s, o) => s + VR.sum(o.items), 0)) + ' sin cobrar' : '')}
        ${k('Ticket promedio', money(cobrados.length ? t(cobrados) / cobrados.length : 0))}
      </div>
      <div class="grid2">
        <div class="card box"><h2>Más vendidos</h2>
          ${topRows.length ? `<table class="tabla"><thead><tr><th>Producto</th><th class="num">Piezas</th><th class="num">Importe</th></tr></thead><tbody>${topRows.map(([n, v]) => `<tr><td>${esc(n)}</td><td class="num">${v.q}</td><td class="num">${money(v.$)}</td></tr>`).join('')}</tbody></table>` : '<p class="empty">Sin ventas este día.</p>'}
        </div>
        <div class="card box"><h2>Cancelaciones</h2>
          ${cancel.length ? `<table class="tabla"><thead><tr><th>Hora</th><th>Pedido</th><th>Devolución</th><th class="num">Monto</th></tr></thead><tbody>${cancel.map((o) => `<tr><td>${VR.hora(o.cancelacion.at)}</td><td>${o.area === 'cafe' ? '☕' : '🥖'} #${o.folio} ${esc(o.cliente)}</td><td>${o.cancelacion.metodo === 'efectivo' ? 'Efectivo' : 'Tarjeta'}</td><td class="num">${money(o.cancelacion.monto)}</td></tr>`).join('')}</tbody></table>` : '<p class="empty">Sin cancelaciones.</p>'}
          <h2 style="margin-top:18px">Pedidos perdidos</h2>
          ${perdidos.length ? `<table class="tabla"><tbody>${perdidos.map((o) => `<tr><td>${VR.hora(o.hora)}</td><td>#${o.folio} ${esc(o.cliente)}</td><td>${esc(o.motivo || 'No llegó')}</td><td class="num">${money(VR.sum(o.items))}</td></tr>`).join('')}</tbody></table>` : '<p class="empty">Ninguno.</p>'}
        </div>
      </div>
      <div class="card box"><h2>Cobros del día</h2>
        ${cobrados.length ? `<table class="tabla"><thead><tr><th>Hora</th><th>Área</th><th>Pedido</th><th>Origen</th><th>Pago</th><th class="num">Total</th></tr></thead><tbody>${cobrados.sort((a, b) => a.pago.at - b.pago.at).map((o) => `<tr><td>${VR.hora(o.pago.at)}</td><td>${o.area === 'cafe' ? 'Cafetería' : 'Panadería'}</td><td>#${o.folio} ${esc(o.cliente)}</td><td>${o.origen === 'web' ? 'Web' : o.tipo === 'vitrina' ? 'Vitrina' : 'Mostrador'}</td><td>${o.pago.metodo === 'efectivo' ? 'Efectivo' : 'Tarjeta'}</td><td class="num">${money(o.pago.total)}</td></tr>`).join('')}</tbody></table>` : '<p class="empty">Sin cobros.</p>'}
      </div>`;
    $('dia').onchange = (e) => { dia = e.target.value || VR.dayKey(); corte(); };
    $('imprimir').onclick = () => window.print();
  }

  // ================= MENÚ Y PRECIOS =================
  function menu() {
    const C = VR.S.catalog;
    const sw = (grp, id, on) => `<button type="button" class="switch" role="switch" aria-checked="${!!on}" data-ag="${grp}:${id}" aria-label="Agotado"></button>`;
    const precio = (grp, id, campo, v) => `<input type="number" min="0" step="1" inputmode="decimal" value="${v}" data-pr="${grp}:${id}:${campo}">`;
    const tablaSimple = (grp, rows, titulo, extra) => `<div class="card box"><h2>${titulo}</h2>
      <table class="tabla"><thead><tr><th>Nombre</th><th class="num">Precio${extra || ''}</th><th>Agotado</th></tr></thead><tbody>
      ${rows.map((r) => `<tr><td>${esc(r.name)}</td><td class="num">${grp === 'milks' && r.id === 'none' ? '—' : precio(grp, r.id, 'price', r.price)}</td><td>${grp === 'milks' && r.id === 'none' ? '' : sw(grp, r.id, r.agotado)}</td></tr>`).join('')}
      </tbody></table></div>`;
    $('vista').innerHTML = `
      <div class="ped-head"><h1>Menú y precios</h1></div>
      <p class="hint" style="margin-top:-6px">Los cambios se guardan al instante y se ven en las dos tablets. Lo marcado como <b>agotado</b> no se puede pedir.</p>
      <div class="grid2">
        ${tablaSimple('coffees', C.coffees, 'Cafés')}
        <div style="display:grid;gap:16px">${tablaSimple('milks', C.milks, 'Leches', ' extra')}${tablaSimple('toppings', C.toppings, 'Toppings', ' extra')}</div>
      </div>
      <div class="card box"><h2>Panes</h2>
        <table class="tabla"><thead><tr><th>Nombre</th><th class="num">Pieza</th><th class="num">Docena</th><th>Agotado</th><th></th></tr></thead><tbody>
        ${C.breads.map((b) => `<tr><td>${esc(b.name)}</td><td class="num">${precio('breads', b.id, 'pieza', b.pieza)}</td><td class="num">${precio('breads', b.id, 'docena', b.docena)}</td><td>${sw('breads', b.id, b.agotado)}</td><td><button class="btn ghost sm" data-delpan="${b.id}">Quitar</button></td></tr>`).join('')}
        </tbody></table>
        <form id="nuevo-pan" style="display:grid;grid-template-columns:1fr 120px 120px auto;gap:8px;margin-top:14px">
          <input type="text" id="np-n" placeholder="Nuevo pan" required maxlength="40">
          <input type="number" id="np-p" placeholder="Pieza" min="0" step="1" required>
          <input type="number" id="np-d" placeholder="Docena" min="0" step="1" required>
          <button class="btn" type="submit">Agregar</button>
        </form>
      </div>`;
    const v = $('vista');
    v.onclick = (e) => {
      const ag = e.target.closest('[data-ag]');
      if (ag) {
        const [g, id] = ag.dataset.ag.split(':');
        const it = VR.by(VR.S.catalog[g], id); it.agotado = !it.agotado; VR.save();
        ag.setAttribute('aria-checked', it.agotado); VR.toast(`${it.name}: ${it.agotado ? 'agotado' : 'disponible'}`);
      }
      const del = e.target.closest('[data-delpan]');
      if (del) {
        const b = VR.by(VR.S.catalog.breads, del.dataset.delpan);
        VR.confirmar(`¿Quitar ${esc(b.name)} del menú?`, 'Quitar', () => { VR.S.catalog.breads = VR.S.catalog.breads.filter((x) => x !== b); VR.save(); menu(); }, true);
      }
    };
    v.onchange = (e) => {
      const p = e.target.closest('[data-pr]');
      if (!p) return;
      const [g, id, campo] = p.dataset.pr.split(':');
      const n = parseFloat(p.value);
      if (isNaN(n) || n < 0) { VR.toast('Precio no válido'); return; }
      VR.by(VR.S.catalog[g], id)[campo] = n; VR.save(); VR.toast('Precio guardado');
    };
    $('nuevo-pan').onsubmit = (e) => {
      e.preventDefault();
      const name = $('np-n').value.trim();
      VR.S.catalog.breads.push({ id: VR.uid(), name, pieza: +$('np-p').value, docena: +$('np-d').value, agotado: false });
      VR.save(); menu(); VR.toast(`${name} agregado`);
    };
  }

  // ================= PEDIDOS DE PAN (casos que resuelve el dueño) =================
  function pedidosPan() {
    const list = VR.S.pan.filter((o) => o.tipo !== 'vitrina' && (o.estado === 'nuevo' || o.estado === 'aceptado')).sort((a, b) => a.fecha.localeCompare(b.fecha));
    $('vista').innerHTML = `<div class="ped-head"><h1>Pedidos de pan</h1></div>
      <p class="hint" style="margin-top:-6px">El barista solo acepta pedidos de pan. Si uno no se puede cumplir, arréglalo con el cliente y cancélalo o cámbiale la fecha aquí.</p>
      <div class="card box">${list.length ? `<table class="tabla"><thead><tr><th>Fecha</th><th>Cliente</th><th>Pedido</th><th>Recibe</th><th class="num">Total</th><th>Estado</th><th></th></tr></thead><tbody>
      ${list.map((o) => `<tr><td style="text-transform:capitalize">${VR.fechaCorta(o.fecha)}</td><td>${esc(o.cliente)}<br><small class="hint">${o.tipo === 'restaurante' ? 'Restaurante' : 'Canasta'} · ${esc(o.tel)}</small></td>
        <td>${o.items.map((l) => `${l.qty} ${esc(l.name)}`).join('<br>')}</td><td>${o.entrega === 'entrega' ? esc(o.ciudad) : 'Pick up'}</td>
        <td class="num">${money(VR.breadTotals(o).total)}</td><td>${o.estado === 'nuevo' ? 'Nuevo' : 'Aceptado'}</td>
        <td style="white-space:nowrap"><button class="btn ghost sm" data-fecha="${o.id}">Cambiar fecha</button> <button class="btn ghost sm danger" data-cancelpan="${o.id}">Cancelar</button></td></tr>`).join('')}
      </tbody></table>` : '<p class="empty">No hay pedidos de pan pendientes.</p>'}</div>`;
    $('vista').onclick = (e) => {
      const c = e.target.closest('[data-cancelpan]');
      const f = e.target.closest('[data-fecha]');
      const id = (c || f) && (c || f).dataset[c ? 'cancelpan' : 'fecha'];
      const o = id && VR.S.pan.find((x) => x.id === id);
      if (!o) return;
      if (c) {
        VR.confirmar(`¿Cancelar el pedido de ${esc(o.cliente)} (${VR.fechaLarga(o.fecha)})?`, 'Cancelar pedido', () => {
          o.estado = 'cancelado'; o.canceladoPorAdmin = Date.now(); VR.save(); pedidosPan(); VR.toast('Pedido cancelado');
        }, true);
      } else {
        const fechas = VR.fechasValidas(o.entrega, o.ciudad, 8);
        const m = VR.modal(`<h2 class="m-title">Nueva fecha</h2><p class="hint">${esc(o.cliente)} · ${o.entrega === 'entrega' ? 'Entrega en ' + esc(o.ciudad) : 'Pick up'}</p>
          <div class="fechas">${fechas.map((x) => `<button class="chip" data-nf="${x}" aria-pressed="${x === o.fecha}">${VR.fechaCorta(x)}</button>`).join('')}</div>
          <div class="m-actions"><button class="btn ghost" data-close>Cerrar</button></div>`);
        m.el.onclick = (ev) => {
          const b = ev.target.closest('[data-nf]');
          if (!b) return;
          o.fecha = b.dataset.nf; VR.save(); m.close(); pedidosPan();
          VR.toast('Fecha cambiada');
          if (o.estado === 'aceptado') VR.wa(o.tel, VR.MSG.pan(o));
        };
      }
    };
  }

  // ================= AJUSTES =================
  function ajustes() {
    $('vista').innerHTML = `<div class="ped-head"><h1>Ajustes</h1></div>
      <div class="grid2">
        <form class="card box" id="f-pin" style="display:grid;gap:12px;align-content:start"><h2>PIN del barista</h2>
          <p class="hint">Sirve para salir del modo cliente y para cobrar cuando la tablet está volteada.</p>
          <input type="text" id="pin" inputmode="numeric" maxlength="4" pattern="\\d{4}" value="${esc(VR.S.settings.pin)}" required>
          <button class="btn" type="submit">Guardar PIN</button></form>
        <div class="card box" style="display:grid;gap:12px;align-content:start"><h2>Datos de prueba</h2>
          <p class="hint">Borra todos los pedidos y ventas de este equipo y vuelve a los precios de ejemplo.</p>
          <button class="btn danger" id="reset">Restablecer prototipo</button></div>
      </div>`;
    $('f-pin').onsubmit = (e) => {
      e.preventDefault();
      const p = $('pin').value;
      if (!/^\d{4}$/.test(p)) { VR.toast('El PIN debe tener 4 dígitos'); return; }
      VR.S.settings.pin = p; VR.save(); VR.toast('PIN guardado');
    };
    $('reset').onclick = () => VR.confirmar('¿Borrar todos los pedidos, ventas y precios de este equipo?', 'Borrar todo', () => { VR.reset(); VR.toast('Prototipo restablecido'); render(); }, true);
  }

  VR.onChange(() => { if (dentro && tab !== 'menu') render(); });
  if (dentro) abrir();
})();
