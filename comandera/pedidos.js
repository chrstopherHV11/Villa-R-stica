// Tablet 2 · Pedidos (junto a la cafetera). Pedidos de la web y del mostrador.
(() => {
  'use strict';
  const { $, esc, money } = VR;
  const { cap, vivo, esPedidoPan, zonaTxt } = TABLERO;
  const T = TABLERO.crear({ rol: 'barra', render: () => render() });

  let area = 'cafe';
  let vistaCafe = 'activos';
  let vistaPan = 'pendientes';
  try { area = sessionStorage.getItem('vr-ped-area') || 'cafe'; } catch (e) { /* */ }

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
        ${columna('Mostrador', 'cobrados · para ahora', mostrador.length, `<div class="pila">${mostrador.map(T.cardCafe).join('')}</div>`, 'Sin pedidos de mostrador.')}
        ${columna('Pick up', 'pedidos de la web', pickup.length, `<div class="pila">${pickup.map(T.cardCafe).join('')}</div>`, 'Cuando llegue un pedido de la web sonará un aviso.')}
      </div>`;
      return;
    }
    const list = vistaCafe === 'perdidos' ? perdidos.sort((a, b) => (b.perdido || 0) - (a.perdido || 0)) : entregados.sort((a, b) => b.entregado - a.entregado);
    $('contenido').innerHTML = list.length ? `<div class="lista">${list.map(T.cardCafe).join('')}</div>` : '<div class="vacio"><h3>Nada por aquí</h3></div>';
  }

  // ================= PANADERÍA =================

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
        ${zonas.map(([z, fn]) => { const os = del.filter(fn); return os.length ? `<p class="zona">${z} · ${os.length}</p><div class="pila">${os.map((o) => T.cardPan(o, false)).join('')}</div>` : ''; }).join('')}
      </div>`;
    }).join('');

    $('contenido').innerHTML = `<div class="cols">
      ${columna('Por confirmar', 'pedidos y canastas nuevos', porConfirmar.length, `<div class="pila">${porConfirmar.map((o) => T.cardPan(o, true)).join('')}</div>`, 'No hay pedidos por confirmar.')}
      ${columna('Confirmados', 'por día de entrega', confirmados.length, porDia, 'Aún no hay pedidos confirmados.')}
    </div>`;
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
        <div class="filas-pago">${list.filter((o) => o.fecha === f).map(T.filaPago).join('')}</div></div>`).join('')}`;
  }
  // ---------- Eventos ----------
  document.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const d = b.dataset;
    if (d.vista) { vistaCafe = d.vista; render(); }
    else if (d.vpan) { vistaPan = d.vpan; render(); }
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
    const n = TABLERO.nuevosDeLaWeb(prev);
    if (n.pan.length) avisar('pan', n.pan[0]);
    else if (n.cafe.length) avisar('cafe', n.cafe[0]);
    else render();
  });
  T.enlazar($('contenido'));

  $('activar').onclick = () => { VR.audio(); VR.sound('cafe'); $('sonido').hidden = true; };

  // Primera vez: pedidos de ejemplo para ver cómo luce
  if (VR.online) document.querySelector('.demo-bar').hidden = true;
  if (!VR.online && !VR.S.settings.sembrado) {
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
