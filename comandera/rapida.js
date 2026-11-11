// Tablet 1 · Comandera rápida (mostrador). Se puede voltear al cliente (modo kiosco).
(() => {
  'use strict';
  const { $, by, esc, money } = VR;

  let area = 'cafe';
  let kiosco = false;
  try { kiosco = sessionStorage.getItem('vr-kiosco') === '1'; area = sessionStorage.getItem('vr-area') || 'cafe'; } catch (e) { /* sin almacenamiento */ }

  // Café
  let cart = [];
  // Pan
  const panVacio = () => ({ modo: 'vitrina', tipo: 'restaurante', qtys: {}, nombre: '', tel: '', entrega: 'pickup', ciudad: 'Mexicali', fecha: null });
  let pan = panVacio();

  const builder = VR.coffeeBuilder($('builder'), (line) => {
    const same = cart.find((l) => l.name === line.name && l.desc === line.desc && l.unit === line.unit);
    if (same) same.qty += line.qty; else cart.push(line);
    VR.toast(`${line.qty}× ${line.name} agregado`);
    renderCafe();
  });

  // ---------- Área y modo ----------
  function setArea(a) {
    area = a;
    try { sessionStorage.setItem('vr-area', a); } catch (e) { /* */ }
    document.body.dataset.area = a;
    VR.areaTabs($('area-tab'), area, setArea);
    $('p-cafe').hidden = $('s-cafe').hidden = a !== 'cafe';
    $('p-pan').hidden = $('s-pan').hidden = a !== 'pan';
    render();
  }
  function setKiosco(on) {
    kiosco = on;
    try { sessionStorage.setItem('vr-kiosco', on ? '1' : '0'); } catch (e) { /* */ }
    document.body.classList.toggle('kiosco', on);
    $('sub').textContent = on ? 'Haz tu pedido' : 'Comandera rápida';
    render();
  }
  $('modo-cliente').onclick = () => { setKiosco(true); VR.toast('Listo: voltea la tablet hacia el cliente'); };
  $('soy-barista').onclick = () => VR.pin('Salir del modo cliente', () => setKiosco(false));

  function render() { if (area === 'cafe') renderCafe(); else renderPan(); }

  // ================= CAFETERÍA =================
  function renderCafe() {
    $('c-lines').innerHTML = cart.map((l, i) => `<li><span class="q">${l.qty}×</span><span><b>${esc(l.name)}</b><span class="d">${esc(l.desc)}</span></span><span class="p">${money(l.unit * l.qty)}</span><button type="button" class="x" data-rm="${i}">Quitar</button></li>`).join('');
    $('c-empty').hidden = !!cart.length;
    const t = VR.sum(cart);
    $('c-total').textContent = money(t);
    $('c-ok').textContent = kiosco ? 'Listo, ya terminé' : `Cobrar ${money(t)}`;
    $('c-ok').disabled = !cart.length;
  }
  $('c-lines').onclick = (e) => {
    const b = e.target.closest('[data-rm]');
    if (!b) return;
    cart.splice(+b.dataset.rm, 1); renderCafe();
  };
  $('c-clear').onclick = () => { cart = []; $('c-nombre').value = ''; builder.reset(); renderCafe(); };
  $('c-ok').onclick = () => {
    const nombre = $('c-nombre').value.trim();
    if (!nombre) { VR.toast('Escribe el nombre para llamarte cuando esté listo'); $('c-nombre').focus(); return; }
    const total = VR.sum(cart);
    if (kiosco) gracias(`¡Gracias, ${esc(VR.first(nombre))}!`, 'Pasa a pagar con el barista.', money(total), () => cobrarCafe(nombre, total));
    else cobrarCafe(nombre, total);
  };
  function cobrarCafe(nombre, total) {
    VR.cobro(total, `Cobrar a ${esc(nombre)}`, (pago) => {
      const o = { id: VR.uid(), folio: VR.folio('cafe'), origen: 'mostrador', cliente: nombre, tel: '', items: cart, hora: Date.now(), estado: 'aceptado', creado: Date.now(), pago };
      VR.S.cafe.push(o); VR.save();
      cerrarGracias();
      VR.toast(`#${o.folio} ${nombre} enviado a la barra${pago.cambio ? ' · Cambio ' + money(pago.cambio) : ''}`);
      cart = []; $('c-nombre').value = ''; builder.reset(); renderCafe();
    });
  }

  // ================= PANADERÍA =================
  const totalPiezas = () => Object.values(pan.qtys).reduce((s, q) => s + q, 0);
  function panLines() {
    if (pan.modo === 'vitrina') {
      return Object.keys(pan.qtys).filter((id) => pan.qtys[id] > 0).map((id) => { const b = by(VR.S.catalog.breads, id); return { pan: id, name: b.name, qty: pan.qtys[id], importe: pan.qtys[id] * b.pieza }; });
    }
    return VR.breadLines(pan.tipo, pan.qtys);
  }
  function encargoObj() {
    return { tipo: pan.tipo, items: panLines(), entrega: pan.entrega, ciudad: pan.entrega === 'entrega' ? pan.ciudad : null };
  }
  function problemas() {
    const n = totalPiezas(), out = [];
    if (pan.modo === 'vitrina') { if (!n) out.push('Elige al menos un pan.'); return out; }
    if (!n) out.push('Elige los panes.');
    if (pan.tipo === 'restaurante' && n && n < 12) out.push(`El pedido de restaurante es de mínimo 12 piezas (llevas ${n}).`);
    if (pan.tipo === 'canasta' && n > 12) out.push('La Canasta es de máximo 12 piezas.');
    if (pan.tipo === 'canasta' && pan.entrega === 'entrega' && pan.ciudad === 'Mexicali') out.push('La Canasta en Mexicali se entrega solo en puntos de entrega (por definir). Elige Pick up o San Luis.');
    if (!pan.nombre.trim()) out.push(pan.tipo === 'restaurante' ? 'Falta el nombre del restaurante.' : 'Falta el nombre.');
    if (pan.tel.replace(/\D/g, '').length !== 10) out.push('El celular debe tener 10 dígitos.');
    if (!pan.fecha) out.push('Elige la fecha.');
    return out;
  }

  function renderPan() {
    const C = VR.S.catalog;
    const enc = pan.modo === 'encargo';
    $('pan-modo').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.modo === pan.modo));
    $('pan-tipo-wrap').hidden = !enc;
    $('pan-tipo').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.tipo === pan.tipo));
    const resto = enc && pan.tipo === 'restaurante';
    const llenoCanasta = enc && pan.tipo === 'canasta' && totalPiezas() >= 12;
    $('breads').innerHTML = C.breads.map((b) => {
      const q = pan.qtys[b.id] || 0;
      const imp = resto ? VR.breadLineTotal('restaurante', b, q) : q * b.pieza;
      return `<div class="bread${q ? ' on' : ''}${b.agotado ? ' off' : ''}">
        ${VR.loaf()}<b>${esc(b.name)}</b>
        <span class="pr">${b.agotado ? 'Agotado' : money(b.pieza) + ' pieza' + (resto ? ' · ' + money(b.docena) + ' docena' : '')}</span>
        <div class="ctl">
          <div class="mini-step">
            ${resto ? `<button type="button" data-b="${b.id}" data-d="-12" ${q < 12 || b.agotado ? 'disabled' : ''}>−12</button>` : ''}
            <button type="button" data-b="${b.id}" data-d="-1" ${!q || b.agotado ? 'disabled' : ''} aria-label="Quitar una pieza">−</button>
            <output>${q}</output>
            <button type="button" data-b="${b.id}" data-d="1" ${b.agotado || llenoCanasta ? 'disabled' : ''} aria-label="Añadir una pieza">+</button>
            ${resto ? `<button type="button" data-b="${b.id}" data-d="12" ${b.agotado ? 'disabled' : ''}>+12</button>` : ''}
          </div>
          <span class="doc">${q ? (resto && VR.docenas(q) ? VR.docenas(q) + ' · ' : '') + money(imp) : ''}</span>
        </div></div>`;
    }).join('');

    $('datos').hidden = !enc;
    if (enc) {
      $('d-nombre-lbl').textContent = pan.tipo === 'restaurante' ? 'Restaurante' : 'Nombre';
      $('d-nombre').placeholder = pan.tipo === 'restaurante' ? 'Ej. Restaurante La Terraza' : 'Ej. Laura Méndez';
      if (document.activeElement !== $('d-nombre')) $('d-nombre').value = pan.nombre;
      if (document.activeElement !== $('d-tel')) $('d-tel').value = pan.tel;
      $('d-entrega').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.entrega === pan.entrega));
      $('d-ciudad-wrap').hidden = pan.entrega !== 'entrega';
      $('d-ciudad').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.ciudad === pan.ciudad));
      const fechas = VR.fechasValidas(pan.entrega, pan.ciudad, 6);
      if (pan.fecha && !fechas.includes(pan.fecha)) pan.fecha = null;
      $('d-fechas').innerHTML = fechas.map((f) => `<button type="button" class="chip" data-fecha="${f}" aria-pressed="${pan.fecha === f}">${VR.fechaCorta(f)}</button>`).join('');
    }

    // Resumen
    const lines = panLines();
    $('pan-side-title').textContent = enc ? (pan.tipo === 'restaurante' ? 'Encargo · Restaurante' : 'Encargo · Canasta') : 'Venta de vitrina';
    $('p-lines').innerHTML = lines.map((l) => `<li><span class="q">${l.qty}×</span><span><b>${esc(l.name)}</b>${enc && pan.tipo === 'restaurante' && VR.docenas(l.qty) ? `<span class="d">${VR.docenas(l.qty)}</span>` : ''}</span><span class="p">${money(l.importe)}</span></li>`).join('');
    $('p-empty').hidden = !!lines.length;
    const t = enc ? VR.breadTotals(encargoObj()) : { sub: lines.reduce((s, l) => s + l.importe, 0), comision: 0 };
    t.total = t.sub + t.comision;
    $('p-sub-row').hidden = $('p-com-row').hidden = !t.comision;
    $('p-sub').textContent = money(t.sub); $('p-com').textContent = money(t.comision);
    $('p-total').textContent = money(t.total);
    $('p-total-lbl').textContent = enc ? `Total · paga al ${pan.entrega === 'entrega' ? 'recibir' : 'recoger'}` : 'Total';
    const probs = problemas();
    const mostrar = enc && totalPiezas() ? probs : [];
    $('p-aviso').hidden = !mostrar.length;
    $('p-aviso').textContent = mostrar[0] || '';
    $('p-ok').textContent = kiosco ? 'Listo, ya terminé' : enc ? 'Guardar encargo' : `Cobrar ${money(t.total)}`;
    $('p-ok').disabled = !totalPiezas();
  }

  $('p-pan').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    const d = b.dataset;
    if (d.modo) { pan.modo = d.modo; pan.qtys = {}; }
    else if (d.tipo) { pan.tipo = d.tipo; pan.qtys = {}; if (d.tipo === 'canasta' && pan.entrega === 'entrega') pan.ciudad = 'San Luis'; }
    else if (d.b) {
      let q = (pan.qtys[d.b] || 0) + +d.d;
      if (pan.modo === 'encargo' && pan.tipo === 'canasta') q = Math.min(q, (pan.qtys[d.b] || 0) + 12 - totalPiezas());
      pan.qtys[d.b] = Math.max(0, q);
    } else if (d.entrega) pan.entrega = d.entrega;
    else if (d.ciudad) pan.ciudad = d.ciudad;
    else if (d.fecha) pan.fecha = d.fecha;
    else return;
    VR.sound('tap');
    renderPan();
  });
  $('d-nombre').oninput = (e) => { pan.nombre = e.target.value; renderPan(); };
  $('d-tel').oninput = (e) => { pan.tel = e.target.value; renderPan(); };
  $('p-clear').onclick = () => { const m = pan.modo; pan = panVacio(); pan.modo = m; renderPan(); };

  $('p-ok').onclick = () => {
    const probs = problemas();
    if (probs.length) { VR.toast(probs[0]); return; }
    const enc = pan.modo === 'encargo';
    const lines = panLines();
    const total = enc ? VR.breadTotals(encargoObj()).total : lines.reduce((s, l) => s + l.importe, 0);
    const seguir = () => (enc ? guardarEncargo() : cobrarVitrina(total));
    if (kiosco) {
      gracias(enc ? `¡Gracias, ${esc(VR.first(pan.nombre))}!` : '¡Gracias!',
        enc ? 'Pasa con el barista para confirmar tu encargo.' : 'Pasa a pagar con el barista.',
        money(total), seguir);
    } else seguir();
  };

  function cobrarVitrina(total) {
    VR.cobro(total, 'Pan de vitrina', (pago) => {
      const o = { id: VR.uid(), folio: VR.folio('pan'), origen: 'mostrador', tipo: 'vitrina', cliente: 'Vitrina', tel: '', items: panLines(), entrega: 'pickup', ciudad: null, fecha: VR.dayKey(), estado: 'entregado', creado: Date.now(), pago };
      VR.S.pan.push(o); VR.save();
      cerrarGracias();
      VR.toast(`Venta registrada${pago.cambio ? ' · Cambio ' + money(pago.cambio) : ''}`);
      pan = panVacio(); renderPan();
    });
  }

  function guardarEncargo() {
    const o = Object.assign({ id: VR.uid(), folio: VR.folio('pan'), origen: 'mostrador', cliente: pan.nombre.trim(), tel: pan.tel.replace(/\D/g, ''), fecha: pan.fecha, estado: 'aceptado', creado: Date.now(), aceptado: Date.now(), pago: null }, encargoObj());
    VR.S.pan.push(o); VR.save();
    cerrarGracias();
    const m = VR.modal(`<h2 class="m-title">Encargo #${o.folio} guardado</h2>
      <p class="m-text">${esc(o.cliente)} · ${VR.fechaLarga(o.fecha)} · ${o.entrega === 'entrega' ? 'Entrega en ' + esc(o.ciudad) : 'Pick up'}</p>
      <p class="hint">Ya aparece en la tablet de Pedidos. Envía la confirmación:</p>
      <div class="m-actions"><button class="btn ghost" data-close>Ahora no</button><button class="btn wa" data-wa>Enviar por WhatsApp</button></div>`);
    m.el.querySelector('[data-wa]').onclick = () => { VR.wa(o.tel, VR.MSG.pan(o)); m.close(); };
    const modo = pan.modo; pan = panVacio(); pan.modo = modo; renderPan();
  }

  // ---------- Pantalla "Pasa con el barista" (modo cliente) ----------
  let accion = null;
  function gracias(titulo, texto, monto, fn) {
    $('g-titulo').innerHTML = titulo; $('g-texto').textContent = texto; $('g-monto').textContent = monto;
    accion = fn; $('gracias').hidden = false;
  }
  function cerrarGracias() { $('gracias').hidden = true; accion = null; }
  $('g-volver').onclick = cerrarGracias;
  $('g-barista').onclick = () => VR.pin('PIN del barista', () => accion && accion());

  // ---------- Ventas de hoy (cancelar con devolución) ----------
  $('ventas').onclick = ventasHoy;
  function ventasHoy() {
    const hoy = VR.dayKey();
    const vs = [...VR.S.cafe.map((o) => Object.assign({ area: 'cafe' }, o)), ...VR.S.pan.map((o) => Object.assign({ area: 'pan' }, o))]
      .filter((o) => o.pago && VR.dayKey(o.pago.at) === hoy)
      .sort((a, b) => b.pago.at - a.pago.at);
    const fila = (o) => `<tr${o.estado === 'cancelado' ? ' style="opacity:.5;text-decoration:line-through"' : ''}>
      <td>${VR.hora(o.pago.at)}</td><td>${o.area === 'cafe' ? '☕' : '🥖'} #${o.folio} ${esc(o.cliente)}</td>
      <td>${o.pago.metodo === 'efectivo' ? 'Efectivo' : 'Tarjeta'}</td><td class="num">${money(o.pago.total)}</td>
      <td>${o.estado === 'cancelado' ? 'Cancelada' : `<button class="btn ghost sm" data-cancel="${o.area}:${o.id}">Cancelar</button>`}</td></tr>`;
    const m = VR.modal(`<h2 class="m-title">Ventas de hoy</h2>
      <p class="hint">Si hubo un error: cancela la venta, devuelve el dinero y vuelve a capturarla. Las cancelaciones quedan registradas en el corte.</p>
      ${vs.length ? `<table class="tabla"><thead><tr><th>Hora</th><th>Pedido</th><th>Pago</th><th class="num">Total</th><th></th></tr></thead><tbody>${vs.map(fila).join('')}</tbody></table>` : '<p class="empty">Todavía no hay ventas cobradas hoy.</p>'}
      <div class="m-actions"><button class="btn ghost" data-close>Cerrar</button></div>`, { wide: true });
    m.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-cancel]');
      if (!b) return;
      const [a, id] = b.dataset.cancel.split(':');
      const o = VR.S[a].find((x) => x.id === id);
      VR.confirmar(`¿Cancelar el pedido #${o.folio} de ${esc(o.cliente)}?\n\nDevuelve ${money(o.pago.total)} ${o.pago.metodo === 'efectivo' ? 'en efectivo' : 'a la tarjeta (en la terminal)'}.`, 'Cancelar y devolver', () => {
        o.cancelacion = { at: Date.now(), monto: o.pago.total, metodo: o.pago.metodo, estadoPrevio: o.estado };
        o.estado = 'cancelado';
        VR.save(); m.close(); VR.toast(`Pedido #${o.folio} cancelado · devuelve ${money(o.pago.total)}`); ventasHoy();
      }, true);
    });
  }

  // Cambios desde la administración (precios, agotados)
  VR.onChange(() => { builder.render(); render(); });

  document.addEventListener('pointerdown', () => VR.audio(), { once: true });
  setKiosco(kiosco);
  setArea(area);
})();
