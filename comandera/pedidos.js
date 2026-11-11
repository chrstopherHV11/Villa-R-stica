// Tablet 2 · Pedidos (junto a la cafetera). Pedidos de la web y del mostrador.
(() => {
  'use strict';
  const { $, by, esc, money } = VR;
  const MIN = 60000;
  const ATENUAR = 30 * MIN; // atenuado si faltan más de 30 min
  const TARDE = 30 * MIN;   // rojo 30 min después de la hora de recogida

  let area = 'cafe';
  let vistaCafe = 'activos';
  let vistaPan = 'pendientes';
  try { area = sessionStorage.getItem('vr-ped-area') || 'cafe'; } catch (e) { /* */ }

  const ESTADO = { nuevo: 'Por aceptar', espera: 'Esperando respuesta', aceptado: 'En preparación', listo: 'Listo', entregado: 'Entregado', perdido: 'Perdido' };
  const MOTIVOS = [
    { id: 'leche', name: 'Cambiar el tipo de leche' },
    { id: 'topping', name: 'Topping agotado' },
    { id: 'disponibilidad', name: 'Sin disponibilidad por el momento' },
    { id: 'otro', name: 'Otro' },
  ];
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const pagoTxt = (p) => (p.metodo === 'efectivo' ? 'Efectivo' : 'Tarjeta');

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

  const columna = (titulo, nota, n, cuerpo, vacio) => `<section class="col">
    <div class="col-head"><h2>${titulo} <span class="col-n">${n}</span></h2>${nota ? `<span class="lbl">${nota}</span>` : ''}</div>
    ${n ? cuerpo : `<p class="col-vacia">${vacio}</p>`}</section>`;

  // ================= CAFETERÍA =================
  const vivo = (o) => ['nuevo', 'espera', 'aceptado', 'listo'].includes(o.estado);
  function renderCafe() {
    $('titulo').textContent = 'Cafetería';
    const hoy = VR.dayKey();
    const perdidos = VR.S.cafe.filter((o) => o.estado === 'perdido');
    const entregados = VR.S.cafe.filter((o) => o.estado === 'entregado' && VR.dayKey(o.entregado || o.creado) === hoy);
    const activos = VR.S.cafe.filter(vivo);
    $('vista').innerHTML = [['activos', `Activos · ${activos.length}`], ['perdidos', `Pedidos perdidos · ${perdidos.length}`], ['entregados', `Entregados hoy · ${entregados.length}`]]
      .map(([k, l]) => `<button type="button" data-vista="${k}" aria-pressed="${vistaCafe === k}">${l}</button>`).join('');

    if (vistaCafe === 'activos') {
      const mostrador = activos.filter((o) => o.origen === 'mostrador').sort((a, b) => a.hora - b.hora);
      // Pick up: primero los que esperan respuesta, luego por hora de recogida
      const pickup = activos.filter((o) => o.origen === 'web')
        .sort((a, b) => ((a.estado === 'espera') !== (b.estado === 'espera') ? (a.estado === 'espera' ? -1 : 1) : a.hora - b.hora));
      $('contenido').innerHTML = `<div class="cols">
        ${columna('Mostrador', 'cobrados · para ahora', mostrador.length, `<div class="pila">${mostrador.map(cardCafe).join('')}</div>`, 'Sin pedidos de mostrador.')}
        ${columna('Pick up', 'pedidos de la web', pickup.length, `<div class="pila">${pickup.map(cardCafe).join('')}</div>`, 'Cuando llegue un pedido de la web sonará un aviso.')}
      </div>`;
      return;
    }
    const list = vistaCafe === 'perdidos' ? perdidos.sort((a, b) => (b.perdido || 0) - (a.perdido || 0)) : entregados.sort((a, b) => b.entregado - a.entregado);
    $('contenido').innerHTML = list.length ? `<div class="lista">${list.map(cardCafe).join('')}</div>` : '<div class="vacio"><h3>Nada por aquí</h3></div>';
  }

  function cardCafe(o) {
    const now = Date.now();
    const web = o.origen === 'web';
    const tarde = web && vivo(o) && now > o.hora + TARDE;
    const dim = vivo(o) && o.estado !== 'espera' && o.estado !== 'nuevo' && o.hora - now > ATENUAR;
    const beige = web && (o.estado === 'nuevo' || o.estado === 'espera');
    const cls = ['ped', o.estado, beige ? 'beige' : '', tarde ? 'tarde' : '', dim ? 'dim' : ''].join(' ');
    const falta = Math.round((o.hora - now) / MIN);
    const sub = !web ? VR.hora(o.hora) : !vivo(o) ? '' : falta > 0 ? `en ${falta} min` : falta === 0 ? 'ya' : `hace ${-falta} min`;
    let acc = '';
    if (o.estado === 'nuevo') acc = `<button class="btn ghost" data-a="rechazar" data-id="${o.id}">Rechazar</button><button class="btn" data-a="aceptar" data-id="${o.id}">Aceptar</button>`;
    else if (o.estado === 'espera') acc = `<button class="btn ghost sm" data-a="perder" data-id="${o.id}">A perdidos</button><button class="btn" data-a="editar" data-id="${o.id}">Editar y aceptar</button>`;
    else if (o.estado === 'aceptado') acc = `<button class="btn" data-a="listo" data-id="${o.id}">Marcar listo</button>`;
    else if (o.estado === 'listo') acc = (web ? `<button class="btn ghost sm" data-a="perder" data-id="${o.id}">A perdidos</button>` : '') + `<button class="btn" data-a="entregar" data-id="${o.id}">${o.pago ? 'Entregado' : 'Cobrar y entregar'}</button>`;
    else if (o.estado === 'perdido') acc = `<button class="btn ghost sm" data-a="recuperar" data-id="${o.id}">Regresar a activos</button>`;
    return `<article class="${cls}">
      <div class="ped-top">
        <div><div class="ped-nombre">${esc(o.cliente)}</div>
          <div class="ped-meta"><span class="tag estado">${tarde ? 'No ha llegado' : ESTADO[o.estado]}</span> · #${o.folio}</div></div>
        <div class="ped-hora">${web ? VR.hora(o.hora) : 'Ahora'}<small>${sub}</small></div>
      </div>
      <ul class="ped-items">${o.items.map((l) => `<li><span class="q">${l.qty}×</span><b>${esc(l.name)}</b>${l.desc ? `<span class="d">${esc(l.desc)}</span>` : ''}</li>`).join('')}</ul>
      ${o.estado === 'espera' ? `<div class="motivo">💬 ${esc(o.motivo || '')} · mensaje enviado ${VR.hora(o.esperaDesde)}</div>` : ''}
      ${tarde ? '<div class="tarde-msg">Pasaron más de 30 min de su hora de recogida.</div>' : ''}
      <div class="ped-pie"><span class="tot">${money(VR.sum(o.items))}</span>${o.pago ? `<span class="pagado">Pagado · ${pagoTxt(o.pago)}</span>` : '<span>Paga al recoger</span>'}</div>
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
      <p class="hint">Elige el motivo. Puedes ajustar el mensaje antes de enviarlo.</p>
      <div class="chips" id="motivos">${MOTIVOS.map((x) => `<button class="chip" data-mot="${x.id}">${x.name}</button>`).join('')}</div>
      <textarea id="msg" placeholder="Elige un motivo"></textarea>
      <div class="m-actions"><button class="btn ghost" data-close>Volver</button><button class="btn" id="enviar" disabled>Continuar</button></div>`);
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
    const items = o.items.map((l) => Object.assign({}, l, { tops: l.tops.slice() }));
    let idx = null; // índice que se está cambiando
    const m = VR.modal(`<h2 class="m-title">Editar pedido · ${esc(o.cliente)}</h2>
      <p class="motivo">💬 ${esc(o.motivo || '')}</p>
      <ul class="lines" id="e-lines"></ul>
      <p class="lbl" id="e-lbl"></p>
      <div id="e-builder"></div>
      <div class="total-row"><span>Total nuevo</span><strong id="e-total"></strong></div>
      <div class="m-actions"><button class="btn ghost" data-close>Volver</button><button class="btn" id="e-ok">Aceptar pedido</button></div>`, { wide: true });
    const el = m.el;
    function mount() {
      const host = el.querySelector('#e-builder');
      const fresh = host.cloneNode(false); host.replaceWith(fresh);
      const init = idx != null ? { cafe: items[idx].cafe, temp: items[idx].temp, milk: items[idx].milk, tops: items[idx].tops, qty: items[idx].qty } : null;
      VR.coffeeBuilder(fresh, (line) => {
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
  const esPedidoPan = (o) => o.tipo !== 'vitrina' && o.estado !== 'cancelado';
  const zonaTxt = (o) => (o.entrega === 'entrega' ? 'Entrega · ' + o.ciudad : 'Pick up');

  function renderPan() {
    $('titulo').textContent = 'Panadería';
    const porPagar = VR.S.pan.filter((o) => esPedidoPan(o) && o.estado === 'entregado' && !o.pago).length;
    $('vista').innerHTML = `<button type="button" data-vpan="pendientes" aria-pressed="${vistaPan === 'pendientes'}">Por entregar</button><button type="button" data-vpan="entregados" aria-pressed="${vistaPan === 'entregados'}">Entregados${porPagar ? ` · ${porPagar} sin pagar` : ''}</button>`;
    if (vistaPan === 'entregados') { renderEntregados(); return; }

    const hoy = VR.dayKey();
    const porConfirmar = VR.S.pan.filter((o) => esPedidoPan(o) && o.estado === 'nuevo').sort((a, b) => a.fecha.localeCompare(b.fecha) || a.creado - b.creado);
    const confirmados = VR.S.pan.filter((o) => esPedidoPan(o) && o.estado === 'aceptado');
    const dias = [...new Set(confirmados.map((o) => o.fecha))].sort();
    const zonas = [['Mexicali', (o) => o.entrega === 'entrega' && o.ciudad === 'Mexicali'], ['San Luis', (o) => o.entrega === 'entrega' && o.ciudad === 'San Luis'], ['Pick up', (o) => o.entrega === 'pickup']];
    const porDia = dias.map((f) => {
      const del = confirmados.filter((o) => o.fecha === f);
      const piezas = {};
      del.forEach((o) => o.items.forEach((l) => { piezas[l.name] = (piezas[l.name] || 0) + l.qty; }));
      const etiqueta = f < hoy ? 'Atrasado' : f === hoy ? 'Hoy' : f === VR.addDays(hoy, 1) ? 'Mañana' : '';
      return `<div class="dia${f < hoy ? ' atrasado' : ''}">
        <div class="dia-head"><h3>${etiqueta ? `<small>${etiqueta}</small>` : ''}${cap(VR.fechaLarga(f))}</h3></div>
        <div class="hornear"><span class="lbl">Hornear:</span>${Object.entries(piezas).sort((a, b) => b[1] - a[1]).map(([n, q]) => `<span class="tag">${q} ${esc(n)}</span>`).join('')}</div>
        ${zonas.map(([z, fn]) => { const os = del.filter(fn); return os.length ? `<p class="zona">${z} · ${os.length}</p><div class="pila">${os.map((o) => cardPan(o, false)).join('')}</div>` : ''; }).join('')}
      </div>`;
    }).join('');

    $('contenido').innerHTML = `<div class="cols">
      ${columna('Por confirmar', 'pedidos y canastas nuevos', porConfirmar.length, `<div class="pila">${porConfirmar.map((o) => cardPan(o, true)).join('')}</div>`, 'No hay pedidos por confirmar.')}
      ${columna('Confirmados', 'por día de entrega', confirmados.length, porDia, 'Aún no hay pedidos confirmados.')}
    </div>`;
  }

  function cardPan(o, conFecha) {
    const t = VR.breadTotals(o);
    let acc = '';
    if (o.estado === 'nuevo') acc = `<button class="btn" data-p="aceptar" data-id="${o.id}">Aceptar y confirmar</button>`;
    else if (o.estado === 'aceptado') {
      acc = `<button class="btn ghost sm" data-p="reenviar" data-id="${o.id}">💬 Reenviar</button>` +
        (o.entrega === 'entrega'
          ? `<button class="btn" data-p="entregado" data-id="${o.id}">Marcar entregado</button>`
          : `<button class="btn" data-p="cobrar" data-id="${o.id}">Cobrar y entregar</button>`);
    }
    const pagoLinea = o.pago ? `<span class="pagado">Pagado · ${pagoTxt(o.pago)}</span>` : `<span>Paga al ${o.entrega === 'entrega' ? 'recibir' : 'recoger'}${t.comision ? ' · incl. 10% envío' : ''}</span>`;
    return `<article class="ped pan ${o.estado}${o.estado === 'nuevo' ? ' beige' : ''}">
      <div class="ped-top">
        <div><div class="ped-nombre">${esc(o.cliente)}</div>
          <div class="ped-meta"><span class="tag">${o.tipo === 'restaurante' ? 'Restaurante' : 'Canasta'}</span> <span class="tag ${o.origen}">${o.origen === 'web' ? 'Web' : 'Mostrador'}</span> · #${o.folio}</div></div>
      </div>
      ${conFecha ? `<div class="ped-fecha">${cap(VR.fechaCorta(o.fecha))} · ${zonaTxt(o)}</div>` : ''}
      <ul class="ped-items">${o.items.map((l) => `<li><span class="q">${l.qty}×</span><b>${esc(l.name)}</b>${VR.docenas(l.qty) ? `<span class="d">${VR.docenas(l.qty)}</span>` : ''}</li>`).join('')}</ul>
      <div class="ped-meta">📞 ${esc(o.tel)}</div>
      <div class="ped-pie"><span class="tot">${money(t.total)}</span>${pagoLinea}</div>
      ${acc ? `<div class="ped-acc">${acc}</div>` : ''}
    </article>`;
  }

  // Entregados: aquí se marca lo que el repartidor ya pagó.
  function renderEntregados() {
    const list = VR.S.pan.filter((o) => esPedidoPan(o) && o.estado === 'entregado').sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.entregado || 0) - (a.entregado || 0));
    if (!list.length) { $('contenido').innerHTML = '<div class="vacio"><h3>Sin entregas todavía</h3>Aquí aparecen los pedidos de pan entregados para marcar cuáles ya se pagaron.</div>'; return; }
    const sin = list.filter((o) => !o.pago), con = list.filter((o) => o.pago);
    const suma = (arr) => arr.reduce((s, o) => s + VR.breadTotals(o).total, 0);
    const dias = [...new Set(list.map((o) => o.fecha))];
    $('contenido').innerHTML = `
      <div class="resumen-pago">
        <div class="card kpi porcobrar"><span>Sin pagar</span><strong>${money(suma(sin))}</strong><em>${sin.length} pedido${sin.length === 1 ? '' : 's'}</em></div>
        <div class="card kpi"><span>Pagados</span><strong>${money(suma(con))}</strong><em>${con.length} pedido${con.length === 1 ? '' : 's'}</em></div>
      </div>
      ${dias.map((f) => `<div class="dia"><div class="dia-head"><h3>${cap(VR.fechaLarga(f))}</h3></div>
        <div class="filas-pago">${list.filter((o) => o.fecha === f).map(filaPago).join('')}</div></div>`).join('')}`;
  }
  function filaPago(o) {
    const pagado = !!o.pago;
    return `<div class="fila-pago${pagado ? '' : ' sin'}">
      <div class="fp-info"><b>${esc(o.cliente)}</b><span>${o.tipo === 'restaurante' ? 'Restaurante' : 'Canasta'} · ${zonaTxt(o)} · #${o.folio}</span>
        <span class="fp-items">${o.items.map((l) => `${l.qty} ${esc(l.name)}`).join(' · ')}</span></div>
      <span class="fp-total">${money(VR.breadTotals(o).total)}</span>
      <button type="button" class="pago-toggle" role="switch" aria-checked="${pagado}" data-pagado="${o.id}">
        <span class="switch-ui" aria-hidden="true"></span><span>${pagado ? 'Pagado' : 'Sin pagar'}</span></button>
    </div>`;
  }

  function accionPan(a, o) {
    if (a === 'aceptar') { o.estado = 'aceptado'; o.aceptado = Date.now(); VR.save(); render(); VR.wa(o.tel, VR.MSG.pan(o)); }
    else if (a === 'reenviar') VR.wa(o.tel, VR.MSG.pan(o));
    else if (a === 'entregado') {
      // Entrega a domicilio: el repartidor cobra; el pago se marca después en "Entregados".
      o.estado = 'entregado'; o.entregado = Date.now(); VR.save(); render();
      VR.toast(`${o.cliente}: entregado · márcalo como pagado cuando llegue el dinero`);
    } else if (a === 'cobrar') {
      VR.cobro(VR.breadTotals(o).total, `Cobrar a ${esc(o.cliente)}`, (pago) => {
        o.pago = pago; o.estado = 'entregado'; o.entregado = Date.now(); VR.save(); render(); VR.toast(`Pedido de ${o.cliente} entregado y cobrado`);
      });
    }
  }
  function togglePagado(o) {
    if (o.pago) { o.pago = null; VR.toast(`${o.cliente}: sin pagar`); }
    else {
      const total = VR.breadTotals(o).total;
      o.pago = { metodo: 'efectivo', total, recibido: total, cambio: 0, at: Date.now(), via: o.entrega === 'entrega' ? 'repartidor' : 'mostrador' };
      VR.toast(`${o.cliente}: pagado ${money(total)}`);
    }
    VR.save(); render();
  }

  // ---------- Eventos ----------
  document.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const d = b.dataset;
    if (d.vista) { vistaCafe = d.vista; render(); }
    else if (d.vpan) { vistaPan = d.vpan; render(); }
    else if (d.a) { const o = findCafe(d.id); if (o) accionCafe(d.a, o); }
    else if (d.p) { const o = VR.S.pan.find((x) => x.id === d.id); if (o) accionPan(d.p, o); }
    else if (d.pagado) { const o = VR.S.pan.find((x) => x.id === d.pagado); if (o) togglePagado(o); }
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
    const nc = VR.S.cafe.filter((o) => !prev.cafe.has(o.id) && o.origen === 'web');
    const np = VR.S.pan.filter((o) => !prev.pan.has(o.id) && o.tipo !== 'vitrina' && o.origen === 'web');
    if (np.length) avisar('pan', np[0]);
    else if (nc.length) avisar('cafe', nc[0]);
    else render();
  });

  $('activar').onclick = () => { VR.audio(); VR.sound('cafe'); $('sonido').hidden = true; };

  // Primera vez: pedidos de ejemplo para ver cómo luce
  if (!VR.S.settings.sembrado) {
    VR.S.settings.sembrado = true;
    [8, 20, 75].forEach((m) => VR.demoCafe(m));
    const mostrador = VR.coffeeLine({ cafe: 'cappuccino', temp: 'hot', milk: 'alm', tops: [], qty: 1 });
    VR.S.cafe.push({ id: VR.uid(), folio: VR.folio('cafe'), origen: 'mostrador', cliente: 'Jorge', tel: '', items: [mostrador], hora: Date.now(), estado: 'aceptado', creado: Date.now(), pago: { metodo: 'efectivo', total: mostrador.unit, recibido: 100, cambio: 100 - mostrador.unit, at: Date.now() } });
    for (let i = 0; i < 5; i++) VR.demoPan();
    VR.S.pan.slice(-3).forEach((o) => { o.estado = 'aceptado'; o.aceptado = Date.now(); });
    VR.save();
  }

  setInterval(render, 30000);
  setArea(area);
})();
