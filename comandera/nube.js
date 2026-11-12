// Villa Rústica · Comandera — conexión con Supabase.
// Lee los pedidos de la página web (pedidos_cafe, pedidos_pan) y las ventas de mostrador
// (ventas_mostrador), los recibe en tiempo real y guarda cada cambio que hace el barista.
// Requiere la migración supabase/03_comandera.sql y una cuenta en la tabla staff.
// Si no hay configuración (o se abre con ?demo), la comandera funciona en modo demostración.
const NUBE = (() => {
  'use strict';
  if (!VR.online) return { activo: false };
  if (!window.supabase) {
    // Hay configuración pero no cargó la librería (sin internet): no se cae a modo demo en silencio.
    document.addEventListener('DOMContentLoaded', () => VR.toast('Sin conexión: no se pudo cargar Supabase. Revisa el internet y recarga.'));
    setTimeout(() => VR.toast('Sin conexión: no se pudo cargar Supabase. Revisa el internet y recarga.'), 500);
    return { activo: false, preparado: new Promise(() => {}) };
  }

  const cfg = window.VR_CONFIG;
  // storageKey propio: la sesión de la comandera es independiente de la de la página web,
  // aunque se abran en el mismo origen (por ejemplo, localhost:5500). Así entrar o salir aquí
  // no cierra la sesión del cliente en la app, y se puede probar con dos cuentas a la vez.
  const sb = window.supabase.createClient(cfg.url, cfg.key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'vr-comandera-auth' } });
  const DIAS = 35; // historial que se carga (para el corte de caja del mes)

  // ---------- Conversión de estados ----------
  const CAFE_A_LOCAL = { pendiente: 'nuevo', aceptado: 'aceptado', listo: 'listo', entregado: 'entregado', espera: 'espera', perdido: 'perdido', rechazado: 'perdido' };
  const CAFE_A_SERVIDOR = { nuevo: 'pendiente', aceptado: 'aceptado', listo: 'listo', entregado: 'entregado', espera: 'espera', perdido: 'perdido' };
  const PAN_A_LOCAL = { pendiente: 'nuevo', aceptado: 'aceptado', entregado: 'entregado', cancelado: 'cancelado' };
  const PAN_A_SERVIDOR = { nuevo: 'pendiente', aceptado: 'aceptado', entregado: 'entregado', cancelado: 'cancelado' };

  // Leches: la app de la página usa nombres completos; la comandera, ids cortos.
  const LECHE_A_LOCAL = { entera: 'entera', deslactosada: 'desl', almendra: 'alm', avena: 'avena', sin: 'none' };
  const LECHE_A_WEB = { entera: 'entera', desl: 'deslactosada', alm: 'almendra', avena: 'avena', none: 'sin' };

  const ms = (iso) => (iso ? Date.parse(iso) : null);
  const iso = (t) => (t ? new Date(t).toISOString() : null);
  const corto = (id) => String(id).slice(0, 4).toUpperCase();
  const num = (v) => (v == null ? null : Number(v));
  const ciudadLocal = (c) => (!c ? null : /san luis/i.test(c) ? 'San Luis' : /mexicali/i.test(c) ? 'Mexicali' : c);

  // ---------- Servidor → comandera ----------
  function itemWebALinea(i) {
    const c = {
      cafe: i.cafe,
      temp: i.temp === 'Frío' ? 'cold' : 'hot',
      milk: LECHE_A_LOCAL[i.leche] || 'entera',
      tops: Array.isArray(i.toppings) ? i.toppings : [],
      qty: Number(i.cantidad) || 1,
      name: (i.descripcion || '').split(' · ')[0] || i.cafe,
    };
    const l = VR.coffeeLine(c);
    if (!VR.by(VR.S.catalog.coffees, i.cafe) && i.precio != null) l.unit = Number(i.precio);
    return l;
  }
  function cafeDesdeServidor(r) {
    const items = (r.items || []).map(itemWebALinea);
    const o = {
      id: r.id, folio: corto(r.id), origen: 'web', cliente: r.nombre, tel: r.telefono, items,
      hora: ms(r.hora_asignada), horaSolicitada: ms(r.hora_solicitada),
      estado: CAFE_A_LOCAL[r.estado] || 'nuevo', motivo: r.motivo || '',
      creado: ms(r.creado_en), aceptado: ms(r.aceptado_en), listo: ms(r.listo_en), entregado: ms(r.entregado_en),
      esperaDesde: ms(r.espera_en), perdido: ms(r.perdido_en), pago: null,
    };
    if (r.pago_metodo) {
      const total = num(r.total) != null ? num(r.total) : VR.sum(items);
      o.pago = { metodo: r.pago_metodo, total, recibido: num(r.pago_recibido) != null ? num(r.pago_recibido) : total, cambio: num(r.cambio) || 0, at: ms(r.entregado_en) || ms(r.actualizado_en) };
    }
    if (r.estado === 'rechazado') o.estadoPrevio = 'espera';
    return o;
  }
  function panDesdeServidor(r) {
    return {
      id: r.id, folio: r.folio || corto(r.id), origen: r.origen, tipo: r.tipo, cliente: r.nombre, tel: r.telefono || '', email: r.email || '',
      items: (r.items || []).map((i) => ({ pan: i.pan, name: i.nombre, qty: Number(i.cantidad), importe: Number(i.importe) })),
      entrega: r.entrega === 'domicilio' ? 'entrega' : 'pickup', ciudad: ciudadLocal(r.ciudad), cp: r.codigo_postal, direccion: r.direccion,
      fecha: r.fecha, horaPickup: r.hora,
      subtotalServidor: num(r.subtotal), comisionServidor: num(r.comision), totalServidor: num(r.total),
      estado: PAN_A_LOCAL[r.estado] || 'nuevo', creado: ms(r.creado_en), aceptado: ms(r.aceptado_en), entregado: ms(r.entregado_en),
      canceladoPorAdmin: ms(r.cancelado_en),
      pago: r.pagado ? { metodo: r.pago_metodo || 'efectivo', total: num(r.total), recibido: num(r.total), cambio: 0, at: ms(r.pagado_en) } : null,
    };
  }
  function ventaDesdeServidor(r) {
    const pago = { metodo: r.pago_metodo, total: num(r.total), recibido: num(r.pago_recibido), cambio: num(r.cambio) || 0, at: ms(r.pagado_en) };
    const cancelacion = r.cancelado_en ? { at: ms(r.cancelado_en), monto: num(r.cancel_monto) || num(r.total), metodo: r.pago_metodo } : undefined;
    const base = { id: r.id, folio: r.folio || corto(r.id), origen: 'mostrador', cliente: r.cliente, tel: '', items: r.items || [], estado: r.estado, creado: ms(r.creado_en), pago, cancelacion };
    if (r.area === 'cafe') return ['cafe', Object.assign(base, { hora: ms(r.creado_en), listo: ms(r.listo_en), entregado: ms(r.entregado_en) })];
    return ['pan', Object.assign(base, { tipo: 'vitrina', entrega: 'pickup', ciudad: null, fecha: VR.dayKey(ms(r.creado_en)), entregado: ms(r.entregado_en) })];
  }

  // ---------- Comandera → servidor ----------
  function lineaAItemWeb(l) {
    return {
      cafe: l.cafe, descripcion: [l.name, l.desc].filter(Boolean).join(' · '),
      temp: l.temp === 'cold' ? 'Frío' : 'Caliente', leche: LECHE_A_WEB[l.milk] || 'entera',
      toppings: l.tops, cantidad: l.qty, precio: l.unit,
    };
  }
  function cafeAServidor(o) {
    return {
      estado: CAFE_A_SERVIDOR[o.estado] || 'pendiente', motivo: o.motivo || '',
      items: o.items.map(lineaAItemWeb), total: VR.sum(o.items),
      pago_metodo: o.pago ? o.pago.metodo : null, pago_recibido: o.pago ? o.pago.recibido : null, cambio: o.pago ? o.pago.cambio : null,
      aceptado_en: iso(o.aceptado), listo_en: iso(o.listo), entregado_en: iso(o.entregado), espera_en: iso(o.esperaDesde), perdido_en: iso(o.perdido),
    };
  }
  function panAServidor(o, nuevo) {
    const t = VR.breadTotals(o);
    const cambios = {
      estado: PAN_A_SERVIDOR[o.estado] || 'pendiente', fecha: o.fecha,
      pagado: !!o.pago, pago_metodo: o.pago ? o.pago.metodo : null, pagado_en: o.pago ? iso(o.pago.at) : null,
      aceptado_en: iso(o.aceptado), entregado_en: iso(o.entregado), cancelado_en: iso(o.canceladoPorAdmin),
    };
    if (!nuevo) return cambios;
    return Object.assign(cambios, {
      id: o.id, origen: 'mostrador', folio: typeof o.folio === 'number' ? o.folio : null, tipo: o.tipo, nombre: o.cliente, telefono: o.tel,
      items: o.items.map((l) => ({ pan: l.pan, nombre: l.name, cantidad: l.qty, importe: l.importe })),
      entrega: o.entrega === 'entrega' ? 'domicilio' : 'pickup', ciudad: o.ciudad, codigo_postal: null, direccion: '',
      subtotal: t.sub, comision: t.comision, total: t.total,
    });
  }
  function ventaAServidor(o, area, nuevo) {
    const p = o.pago || {};
    const cambios = {
      estado: o.estado, listo_en: iso(o.listo), entregado_en: iso(o.entregado),
      cancelado_en: o.cancelacion ? iso(o.cancelacion.at) : null, cancel_monto: o.cancelacion ? o.cancelacion.monto : null,
    };
    if (!nuevo) return cambios;
    return Object.assign(cambios, {
      id: o.id, folio: typeof o.folio === 'number' ? o.folio : null, area, cliente: o.cliente || '', items: o.items, total: p.total,
      pago_metodo: p.metodo, pago_recibido: p.recibido, cambio: p.cambio, pagado_en: iso(p.at),
    });
  }

  // ---------- Carga y tiempo real ----------
  let snap = new Map();      // id → JSON del pedido tal como está en el servidor
  let estadoServidor = new Map(); // id → estado en el servidor cuando esta tablet lo cargó
  let tabla = new Map();     // id → tabla de origen
  const firma = (o) => JSON.stringify(o);

  async function cargar(silencioso) {
    const desde = new Date(Date.now() - DIAS * 86400000).toISOString();
    const [c, p, v] = await Promise.all([
      sb.from('pedidos_cafe').select('*').or(`creado_en.gte.${desde},estado.in.(pendiente,aceptado,listo,espera)`).order('hora_asignada'),
      sb.from('pedidos_pan').select('*').or(`creado_en.gte.${desde},estado.in.(pendiente,aceptado)`).order('fecha'),
      sb.from('ventas_mostrador').select('*').gte('creado_en', desde).order('creado_en'),
    ]);
    const err = c.error || p.error || v.error;
    if (err) { estado('error', err.message); throw err; }
    const cafe = c.data.map(cafeDesdeServidor);
    const pan = p.data.map(panDesdeServidor);
    tabla = new Map();
    cafe.forEach((o) => tabla.set(o.id, 'pedidos_cafe'));
    pan.forEach((o) => tabla.set(o.id, 'pedidos_pan'));
    v.data.forEach((r) => {
      const [area, o] = ventaDesdeServidor(r);
      (area === 'cafe' ? cafe : pan).push(o);
      tabla.set(o.id, 'ventas_mostrador');
    });
    snap = new Map([...cafe, ...pan].map((o) => [o.id, firma(o)]));
    estadoServidor = new Map([...c.data, ...p.data, ...v.data].map((r) => [r.id, r.estado]));
    VR.setData(cafe, pan, silencioso);
    estado('ok');
  }

  let pendiente = null;
  function recargarPronto() {
    clearTimeout(pendiente);
    pendiente = setTimeout(() => cargar(false).catch(() => {}), 250);
  }
  function escuchar() {
    sb.channel('comandera')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos_cafe' }, recargarPronto)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos_pan' }, recargarPronto)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ventas_mostrador' }, recargarPronto)
      .subscribe((s) => { if (s === 'SUBSCRIBED') estado('ok'); else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') estado('error', 'Sin tiempo real'); });
    // Respaldo por si se pierde la conexión en tiempo real.
    setInterval(() => cargar(false).catch(() => {}), 60000);
  }

  // ---------- Guardar lo que cambió ----------
  // Cada cambio se guarda solo si el pedido sigue en el estado en que esta tablet lo vio.
  // Si la otra tablet ya lo atendió, no se pisa: se avisa, se recarga y la acción no sigue.
  let guardando = Promise.resolve([]);
  function sincronizar() {
    guardando = guardando.catch(() => []).then(async () => {
      const choques = [];
      const ops = [];
      VR.S.cafe.forEach((o) => ops.push(['cafe', o]));
      VR.S.pan.forEach((o) => ops.push(['pan', o]));
      for (const [area, o] of ops) {
        const f = firma(o);
        const antes = snap.get(o.id);
        if (antes === f) continue;
        const nuevo = antes == null;
        let t, fila;
        if (area === 'cafe' && o.origen === 'web') { t = 'pedidos_cafe'; fila = cafeAServidor(o); if (nuevo) continue; }
        else if (area === 'cafe' || o.tipo === 'vitrina') { t = 'ventas_mostrador'; fila = ventaAServidor(o, area, nuevo); }
        else { t = 'pedidos_pan'; fila = panAServidor(o, nuevo); }
        let q;
        if (nuevo) q = sb.from(t).insert(fila);
        else {
          q = sb.from(t).update(fila).eq('id', o.id);
          if (estadoServidor.has(o.id)) q = q.eq('estado', estadoServidor.get(o.id));
          q = q.select('id');
        }
        const { data, error } = await q;
        if (error) {
          VR.toast('No se guardó en el servidor: ' + error.message);
          estado('error', error.message);
          choques.push(o.id);
          await cargar(true).catch(() => {});
          return choques;
        }
        if (!nuevo && Array.isArray(data) && data.length === 0) {
          VR.toast(`Este pedido ya fue atendido en la otra tablet (${o.cliente}).`);
          choques.push(o.id);
          await cargar(true).catch(() => {});
          return choques;
        }
        snap.set(o.id, f);
        tabla.set(o.id, t);
        if (fila.estado) estadoServidor.set(o.id, fila.estado);
      }
      return choques;
    });
    return guardando;
  }
  VR.onSave(sincronizar);

  // ---------- Indicador de conexión ----------
  function estado(tipo, msg) {
    let el = document.getElementById('nube-estado');
    if (!el) {
      el = document.createElement('span');
      el.id = 'nube-estado';
      el.className = 'nube-estado';
      const top = document.querySelector('.top .spacer');
      if (top) top.after(el); else document.body.appendChild(el);
    }
    el.dataset.estado = tipo;
    el.textContent = tipo === 'ok' ? 'En línea' : tipo === 'error' ? 'Sin conexión' : 'Conectando…';
    el.title = msg || '';
  }

  // ---------- Inicio de sesión del barista ----------
  function pantallaLogin(mensaje) {
    let el = document.getElementById('nube-login');
    if (el) el.remove();
    el = document.createElement('div');
    el.id = 'nube-login';
    el.className = 'nube-login';
    el.innerHTML = `<form class="card">
      <img src="logo.png" alt="" width="60" height="57" style="margin:0 auto">
      <h1>Iniciar sesión</h1>
      <p class="hint">Entra con la cuenta del barista. Solo se hace una vez en cada tablet.</p>
      <label class="field" style="text-align:left"><span class="lbl">Correo</span><input type="email" id="nl-email" autocomplete="username" required></label>
      <label class="field" style="text-align:left"><span class="lbl">Contraseña</span><input type="password" id="nl-pass" autocomplete="current-password" required></label>
      <p class="aviso" id="nl-error" ${mensaje ? '' : 'hidden'}>${VR.esc(mensaje || '')}</p>
      <button class="btn lg block" type="submit">Entrar</button>
    </form>`;
    document.body.appendChild(el);
    el.querySelector('form').onsubmit = async (e) => {
      e.preventDefault();
      const b = el.querySelector('button'); b.disabled = true; b.textContent = 'Entrando…';
      const { error } = await sb.auth.signInWithPassword({ email: el.querySelector('#nl-email').value.trim(), password: el.querySelector('#nl-pass').value });
      if (error) {
        b.disabled = false; b.textContent = 'Entrar';
        const er = el.querySelector('#nl-error'); er.hidden = false; er.textContent = 'Correo o contraseña incorrectos.';
        return;
      }
      el.remove();
      arrancar();
    };
  }

  // Los pedidos de café de días anteriores que nunca se entregaron pasan a "perdido":
  // así liberan su hora y no cuentan para el límite de 5 pedidos de la clienta.
  function cerrarDiasAnteriores() {
    const hoy = VR.dayKey();
    const viejos = VR.S.cafe.filter((o) => o.origen === 'web' && ['nuevo', 'aceptado', 'espera', 'listo'].includes(o.estado) && VR.dayKey(o.hora) < hoy);
    if (!viejos.length) return;
    viejos.forEach((o) => { o.estadoPrevio = o.estado; o.estado = 'perdido'; o.perdido = Date.now(); if (!o.motivo) o.motivo = 'No se recogió'; });
    VR.save();
    VR.toast(`${viejos.length} pedido${viejos.length > 1 ? 's' : ''} de días anteriores pasaron a Pedidos perdidos`);
  }

  let listo;
  const preparado = new Promise((r) => { listo = r; });
  async function arrancar() {
    estado('cargando');
    const { data } = await sb.auth.getSession();
    if (!data.session) { pantallaLogin(); return; }
    const requiere = document.body.dataset.requiere || 'staff';
    const { data: permitido, error } = await sb.rpc(requiere === 'admin' ? 'es_admin' : 'es_staff');
    if (error || !permitido) {
      await sb.auth.signOut();
      pantallaLogin(error ? 'Falta ejecutar la migración 03 en Supabase.' : requiere === 'admin' ? 'Esta cuenta no es de administrador.' : 'Esta cuenta no está dada de alta como barista.');
      return;
    }
    try { await cargar(true); cerrarDiasAnteriores(); } catch (e) { VR.toast('No se pudieron cargar los pedidos: ' + e.message); }
    escuchar();
    listo();
  }

  arrancar();
  return { activo: true, sb, preparado, recargar: () => cargar(false), salir: async () => { await sb.auth.signOut(); location.reload(); } };
})();
