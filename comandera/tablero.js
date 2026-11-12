// Villa Rústica · Comandera — tarjetas y acciones de pedidos, compartidas por las dos tablets.
//   rol 'barra'     → Tablet 2 (pedidos.html, junto a la cafetera): puede todo.
//   rol 'mostrador' → Tablet 1 (rapida.html): solo acepta, rechaza o pregunta por un cambio
//                     (y edita y acepta cuando la clienta responde). No marca listo, entregado
//                     ni pagado, ni retira comandas: eso es de la barra.
// Cada cambio se guarda solo si el pedido sigue como esta tablet lo vio (ver nube.js);
// si la otra tablet ya lo atendió, se avisa y no se abre el WhatsApp.
const TABLERO = (() => {
  'use strict';
  const { by, esc, money } = VR;
  const MIN = 60000;
  const ATENUAR = 30 * MIN; // atenuado si faltan más de 30 min
  const TARDE = 30 * MIN;   // rojo 30 min después de la hora de recogida

  const ESTADO = { nuevo: 'Por aceptar', espera: 'Esperando respuesta', aceptado: 'En preparación', listo: 'Listo', entregado: 'Entregado', perdido: 'Perdido' };
  const MOTIVOS = [
    { id: 'leche', name: 'Cambiar el tipo de leche' },
    { id: 'topping', name: 'Topping agotado' },
    { id: 'disponibilidad', name: 'Sin disponibilidad por el momento' },
    { id: 'otro', name: 'Otro' },
  ];
  const PERMISOS_MOSTRADOR = ['c:aceptar', 'c:rechazar', 'c:editar', 'p:aceptar', 'p:reenviar'];

  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const pagoTxt = (p) => (p.metodo === 'efectivo' ? 'Efectivo' : 'Tarjeta');
  const vivo = (o) => ['nuevo', 'espera', 'aceptado', 'listo'].includes(o.estado);
  const esPedidoPan = (o) => o.tipo !== 'vitrina' && o.estado !== 'cancelado';
  const zonaTxt = (o) => (o.entrega === 'entrega' ? 'Entrega · ' + o.ciudad : 'Pick up');

  function crear(opts) {
    const rol = opts.rol || 'barra';
    const render = opts.render || (() => {});
    const puede = (accion) => rol === 'barra' || PERMISOS_MOSTRADOR.includes(accion);
    const boton = (accion, html) => (puede(accion) ? html : '');

    // Guarda y, solo si el pedido no lo cambió antes la otra tablet, sigue (WhatsApp, avisos…).
    function guardar(o, despues) {
      render();
      Promise.resolve(VR.save()).then((choques) => {
        if (Array.isArray(choques) && choques.includes(o.id)) return; // nube.js ya avisó y recargó
        if (despues) despues();
      });
    }

    // ================= CAFÉ =================
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
      if (o.estado === 'nuevo') {
        acc = boton('c:rechazar', `<button class="btn ghost" data-a="rechazar" data-id="${o.id}">Rechazar</button>`) +
          boton('c:aceptar', `<button class="btn" data-a="aceptar" data-id="${o.id}">Aceptar</button>`);
      } else if (o.estado === 'espera') {
        acc = boton('c:perder', `<button class="btn ghost sm" data-a="perder" data-id="${o.id}">A perdidos</button>`) +
          boton('c:editar', `<button class="btn" data-a="editar" data-id="${o.id}">Editar y aceptar</button>`);
      } else if (o.estado === 'aceptado') {
        acc = boton('c:listo', `<button class="btn" data-a="listo" data-id="${o.id}">Marcar listo</button>`);
      } else if (o.estado === 'listo') {
        acc = (web ? boton('c:perder', `<button class="btn ghost sm" data-a="perder" data-id="${o.id}">A perdidos</button>`) : '') +
          boton('c:entregar', `<button class="btn" data-a="entregar" data-id="${o.id}">${o.pago ? 'Entregado' : 'Cobrar y entregar'}</button>`);
      } else if (o.estado === 'perdido') {
        acc = boton('c:recuperar', `<button class="btn ghost sm" data-a="recuperar" data-id="${o.id}">Regresar a activos</button>`);
      }
      const nota = !acc && rol === 'mostrador' && (o.estado === 'aceptado' || o.estado === 'listo')
        ? `<div class="ped-nota">${o.estado === 'listo' ? 'Listo en la barra · la barra lo entrega' : 'La barra lo está preparando'}</div>` : '';
      return `<article class="${cls}">
        <div class="ped-top">
          <div><div class="ped-nombre">${esc(o.cliente)}</div>
            <div class="ped-meta"><span class="tag estado">${tarde ? 'No ha llegado' : ESTADO[o.estado]}</span> · #${o.folio}</div></div>
          <div class="ped-hora">${web ? VR.hora(o.hora) : 'Ahora'}<small>${sub}</small></div>
        </div>
        <ul class="ped-items">${o.items.map((l) => `<li><span class="q">${l.qty}×</span><b>${esc(l.name)}</b>${l.desc ? `<span class="d">${esc(l.desc)}</span>` : ''}</li>`).join('')}</ul>
        ${o.estado === 'espera' ? `<div class="motivo">💬 ${esc(o.motivo || '')} · mensaje enviado ${o.esperaDesde ? VR.hora(o.esperaDesde) : ''}</div>` : ''}
        ${tarde ? '<div class="tarde-msg">Pasaron más de 30 min de su hora de recogida.</div>' : ''}
        <div class="ped-pie"><span class="tot">${money(VR.sum(o.items))}</span>${o.pago ? `<span class="pagado">Pagado · ${pagoTxt(o.pago)}</span>` : '<span>Paga al recoger</span>'}</div>
        ${acc ? `<div class="ped-acc">${acc}</div>` : nota}
      </article>`;
    }

    function accionCafe(a, o) {
      if (!puede('c:' + a)) return;
      if (a === 'aceptar') {
        o.estado = 'aceptado'; o.aceptado = Date.now();
        guardar(o, () => { if (o.origen === 'web') VR.wa(o.tel, VR.MSG.cafeAceptado(o)); });
      } else if (a === 'listo') {
        o.estado = 'listo'; o.listo = Date.now();
        guardar(o, () => { if (o.origen === 'web') VR.wa(o.tel, VR.MSG.cafeListo(o)); else VR.toast(`Llama a ${o.cliente}: su café está listo`); });
      } else if (a === 'entregar') {
        const fin = () => { o.estado = 'entregado'; o.entregado = Date.now(); guardar(o, () => VR.toast(`#${o.folio} ${o.cliente} entregado`)); };
        if (o.pago) fin();
        else VR.cobro(VR.sum(o.items), `Cobrar a ${esc(o.cliente)}`, (pago) => { o.pago = pago; fin(); });
      } else if (a === 'rechazar') rechazar(o);
      else if (a === 'editar') editar(o);
      else if (a === 'perder') {
        VR.confirmar(`¿Mandar el pedido de ${esc(o.cliente)} a Pedidos perdidos?\nNo se cobra.`, 'Mandar a perdidos', () => {
          o.estadoPrevio = o.estado; o.estado = 'perdido'; o.perdido = Date.now(); guardar(o);
        });
      } else if (a === 'recuperar') { o.estado = o.estadoPrevio || 'espera'; guardar(o); }
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
        const texto = msg.value;
        o.estado = 'espera'; o.motivo = motivo.name; o.esperaDesde = Date.now(); o.mensaje = texto;
        m.close();
        guardar(o, () => VR.wa(o.tel, texto));
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
        m.close();
        guardar(o, () => VR.wa(o.tel, VR.MSG.cafeAceptado(o)));
      };
      idx = items.length === 1 ? 0 : null;
      mount(); paint();
    }

    // ================= PAN =================
    function cardPan(o, conFecha) {
      const t = VR.breadTotals(o);
      let acc = '';
      if (o.estado === 'nuevo') acc = boton('p:aceptar', `<button class="btn" data-p="aceptar" data-id="${o.id}">Aceptar y confirmar</button>`);
      else if (o.estado === 'aceptado') {
        acc = boton('p:reenviar', `<button class="btn ghost sm" data-p="reenviar" data-id="${o.id}">💬 Reenviar</button>`) +
          (o.entrega === 'entrega'
            ? boton('p:entregado', `<button class="btn" data-p="entregado" data-id="${o.id}">Marcar entregado</button>`)
            : boton('p:cobrar', `<button class="btn" data-p="cobrar" data-id="${o.id}">Cobrar y entregar</button>`));
      }
      const pagoLinea = o.pago ? `<span class="pagado">Pagado · ${pagoTxt(o.pago)}</span>` : `<span>Paga al ${o.entrega === 'entrega' ? 'recibir' : 'recoger'}${t.comision ? ' · incl. 10% envío' : ''}</span>`;
      return `<article class="ped pan ${o.estado}${o.estado === 'nuevo' ? ' beige' : ''}">
        <div class="ped-top">
          <div><div class="ped-nombre">${esc(o.cliente)}</div>
            <div class="ped-meta"><span class="tag">${o.tipo === 'restaurante' ? 'Restaurante' : 'Canasta'}</span> <span class="tag ${o.origen}">${o.origen === 'web' ? 'Web' : 'Mostrador'}</span> · #${o.folio}</div></div>
        </div>
        ${conFecha ? `<div class="ped-fecha">${cap(VR.fechaCorta(o.fecha))} · ${zonaTxt(o)}</div>` : ''}
        <ul class="ped-items">${o.items.map((l) => `<li><span class="q">${l.qty}×</span><b>${esc(l.name)}</b>${VR.docenas(l.qty) ? `<span class="d">${VR.docenas(l.qty)}</span>` : ''}</li>`).join('')}</ul>
        <div class="ped-meta">${o.tel ? '📞 ' + esc(o.tel) : ''}${o.tel && o.email ? ' · ' : ''}${o.email ? '✉ ' + esc(o.email) : ''}</div>
        <div class="ped-pie"><span class="tot">${money(t.total)}</span>${pagoLinea}</div>
        ${acc ? `<div class="ped-acc">${acc}</div>` : ''}
      </article>`;
    }

    function filaPago(o) {
      const pagado = !!o.pago;
      return `<div class="fila-pago${pagado ? '' : ' sin'}">
        <div class="fp-info"><b>${esc(o.cliente)}</b><span>${o.tipo === 'restaurante' ? 'Restaurante' : 'Canasta'} · ${zonaTxt(o)} · #${o.folio}</span>
          <span class="fp-items">${o.items.map((l) => `${l.qty} ${esc(l.name)}`).join(' · ')}</span></div>
        <span class="fp-total">${money(VR.breadTotals(o).total)}</span>
        ${puede('p:pagado') ? `<button type="button" class="pago-toggle" role="switch" aria-checked="${pagado}" data-pagado="${o.id}">
          <span class="switch-ui" aria-hidden="true"></span><span>${pagado ? 'Pagado' : 'Sin pagar'}</span></button>` : `<span>${pagado ? 'Pagado' : 'Sin pagar'}</span>`}
      </div>`;
    }

    function accionPan(a, o) {
      if (!puede('p:' + a)) return;
      if (a === 'aceptar') { o.estado = 'aceptado'; o.aceptado = Date.now(); guardar(o, () => VR.wa(o.tel, VR.MSG.pan(o), o.email)); }
      else if (a === 'reenviar') VR.wa(o.tel, VR.MSG.pan(o), o.email);
      else if (a === 'entregado') {
        // Entrega a domicilio: el repartidor cobra; el pago se marca después en "Entregados".
        o.estado = 'entregado'; o.entregado = Date.now();
        guardar(o, () => VR.toast(`${o.cliente}: entregado · márcalo como pagado cuando llegue el dinero`));
      } else if (a === 'cobrar') {
        VR.cobro(VR.breadTotals(o).total, `Cobrar a ${esc(o.cliente)}`, (pago) => {
          o.pago = pago; o.estado = 'entregado'; o.entregado = Date.now();
          guardar(o, () => VR.toast(`Pedido de ${o.cliente} entregado y cobrado`));
        });
      }
    }
    function togglePagado(o) {
      if (!puede('p:pagado')) return;
      if (o.pago) { o.pago = null; VR.toast(`${o.cliente}: sin pagar`); }
      else {
        const total = VR.breadTotals(o).total;
        o.pago = { metodo: 'efectivo', total, recibido: total, cambio: 0, at: Date.now(), via: o.entrega === 'entrega' ? 'repartidor' : 'mostrador' };
        VR.toast(`${o.cliente}: pagado ${money(total)}`);
      }
      guardar(o);
    }

    // Botones de las tarjetas dentro de `raiz`.
    function enlazar(raiz) {
      raiz.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        const d = b.dataset;
        if (d.a) { const o = VR.S.cafe.find((x) => x.id === d.id); if (o) accionCafe(d.a, o); }
        else if (d.p) { const o = VR.S.pan.find((x) => x.id === d.id); if (o) accionPan(d.p, o); }
        else if (d.pagado) { const o = VR.S.pan.find((x) => x.id === d.pagado); if (o) togglePagado(o); }
      });
    }

    return { cardCafe, cardPan, filaPago, enlazar, puede };
  }

  // Aviso con sonido cuando llega un pedido nuevo de la página web.
  function nuevosDeLaWeb(prev) {
    return {
      cafe: VR.S.cafe.filter((o) => !prev.cafe.has(o.id) && o.origen === 'web'),
      pan: VR.S.pan.filter((o) => !prev.pan.has(o.id) && o.tipo !== 'vitrina' && o.origen === 'web'),
    };
  }

  return { crear, nuevosDeLaWeb, vivo, esPedidoPan, zonaTxt, cap };
})();
