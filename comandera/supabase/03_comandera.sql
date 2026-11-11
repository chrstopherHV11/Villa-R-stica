-- =====================================================================
-- Villa Rústica · Migración 03 · Comandera
-- ---------------------------------------------------------------------
-- NO SE HA EJECUTADO. Revísala y ejecútala tú en el SQL Editor de Supabase
-- (proyecto xbnlghelucmnsufsojdi), después de la migración 02.
-- Todo va en una transacción: si algo falla, no se aplica nada.
--
-- Qué hace:
--   1. Rol de staff (barista) que ve y atiende pedidos, sin acceso al panel admin.
--   2. Pedidos de café: estados listo, espera y perdido; datos de cobro y horas
--      de cada paso. La RPC crear_pedido_cafe y estado_cafe se actualizan.
--   3. Pedidos de pan (restaurante y Canasta) en la tabla nueva pedidos_pan, con
--      la RPC crear_pedido_pan para la app de la página web.
--   4. Ventas de mostrador (café y pan de vitrina) en ventas_mostrador, para que
--      las dos tablets compartan lo que se cobra en el mostrador.
--   5. Tiempo real en las tablas nuevas.
--
-- Después de ejecutarla, da de alta la cuenta del barista (ver el final).
-- =====================================================================
begin;

-- ---------------------------------------------------------------------
-- 1. Staff
-- ---------------------------------------------------------------------
create table if not exists public.staff (
  user_id uuid primary key references auth.users (id) on delete cascade,
  rol text not null default 'barista' check (rol in ('barista', 'mostrador')),
  creado_en timestamptz not null default now()
);
alter table public.staff enable row level security;

create or replace function public.es_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff where user_id = auth.uid()) or public.es_admin();
$$;
grant execute on function public.es_staff() to authenticated;

drop policy if exists "staff se ve" on public.staff;
create policy "staff se ve" on public.staff for select using (user_id = auth.uid() or public.es_admin());

-- ---------------------------------------------------------------------
-- 2. Pedidos de café
-- ---------------------------------------------------------------------
-- 'pendiente' se queda como el estado inicial (la comandera lo muestra como "Por aceptar").
alter table public.pedidos_cafe drop constraint if exists pedidos_cafe_estado_check;
alter table public.pedidos_cafe add constraint pedidos_cafe_estado_check
  check (estado in ('pendiente', 'aceptado', 'listo', 'entregado', 'rechazado', 'espera', 'perdido'));

alter table public.pedidos_cafe
  add column if not exists pago_metodo text check (pago_metodo is null or pago_metodo in ('efectivo', 'tarjeta')),
  add column if not exists pago_recibido numeric(10,2),
  add column if not exists cambio numeric(10,2),
  add column if not exists aceptado_en timestamptz,
  add column if not exists listo_en timestamptz,
  add column if not exists entregado_en timestamptz,
  add column if not exists espera_en timestamptz,
  add column if not exists perdido_en timestamptz;

-- Apartan la hora: pendiente, aceptado, listo y espera. Perdido, rechazado y entregado la liberan.
drop index if exists public.pedidos_cafe_hora_ocupada;
create unique index pedidos_cafe_hora_ocupada on public.pedidos_cafe (hora_asignada)
  where estado in ('pendiente', 'aceptado', 'listo', 'espera');

drop policy if exists "ver pedidos propios o admin" on public.pedidos_cafe;
drop policy if exists "ver pedidos propios o staff" on public.pedidos_cafe;
create policy "ver pedidos propios o staff" on public.pedidos_cafe
  for select using (auth.uid() = user_id or public.es_staff());
drop policy if exists "admin actualiza pedidos" on public.pedidos_cafe;
drop policy if exists "staff actualiza pedidos" on public.pedidos_cafe;
create policy "staff actualiza pedidos" on public.pedidos_cafe
  for update using (public.es_staff()) with check (public.es_staff());
-- "admin borra pedidos" se queda igual.

-- Misma RPC de la migración 02; solo cambia la lista de estados que apartan la hora.
create or replace function public.crear_pedido_cafe(p_nombre text, p_telefono text, p_items jsonb, p_total numeric, p_hora timestamptz)
returns table (id uuid, hora_asignada timestamptz) language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  zona constant text := 'America/Hermosillo';
  paso constant interval := interval '2 minutes';
  v_uid uuid := auth.uid(); v_hora timestamptz; v_local timestamp; v_cierre timestamptz;
  v_tel text := regexp_replace(coalesce(p_telefono, ''), '[^0-9+]', '', 'g');
  v_id uuid;
begin
  if v_uid is null then raise exception 'Debes iniciar sesión para hacer tu pedido.'; end if;
  if coalesce(trim(p_nombre), '') = '' then raise exception 'Escribe tu nombre.'; end if;
  if length(regexp_replace(v_tel, '[^0-9]', '', 'g')) < 10 then raise exception 'Escribe un celular válido (10 dígitos).'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Tu pedido está vacío.'; end if;
  if jsonb_array_length(p_items) > 30 then raise exception 'El pedido tiene demasiados productos.'; end if;
  if p_total is not null and p_total < 0 then raise exception 'El total no es válido.'; end if;
  if p_hora is null then raise exception 'Elige la hora para recoger.'; end if;
  v_hora := date_trunc('minute', p_hora);
  if v_hora < now() - interval '2 minutes' then raise exception 'Esa hora ya pasó. Elige otra.'; end if;
  if v_hora < now() then v_hora := date_trunc('minute', now()) + interval '1 minute'; end if;
  if v_hora > now() + interval '7 days' then raise exception 'Solo se aceptan pedidos con hasta 7 días de anticipación.'; end if;
  v_local := v_hora at time zone zona;
  if extract(isodow from v_local) = 7 then raise exception 'Los domingos la cafetería está cerrada.'; end if;
  if v_local::time < time '08:00' or v_local::time >= time '17:00' then raise exception 'El horario para recoger es de 8:00 a 17:00.'; end if;
  if (select count(*) from public.pedidos_cafe pc where pc.user_id = v_uid and pc.estado = 'pendiente') >= 5 then
    raise exception 'Ya tienes 5 pedidos pendientes. Espera a que los confirmen.'; end if;
  perform pg_advisory_xact_lock(hashtext('pedidos_cafe_horas'));
  while exists (select 1 from public.pedidos_cafe pc where pc.hora_asignada = v_hora and pc.estado in ('pendiente', 'aceptado', 'listo', 'espera')) loop
    v_hora := v_hora + paso; end loop;
  v_cierre := ((v_local::date + time '17:00') at time zone zona);
  if v_hora >= v_cierre then raise exception 'Ya no hay horas libres ese día. Elige otra hora u otro día.'; end if;
  insert into public.pedidos_cafe (user_id, nombre, telefono, items, total, hora_solicitada, hora_asignada)
  values (v_uid, trim(p_nombre), v_tel, p_items, p_total, date_trunc('minute', p_hora), v_hora)
  returning pedidos_cafe.id into v_id;
  return query select v_id, v_hora;
end; $$;
revoke execute on function public.crear_pedido_cafe(text, text, jsonb, numeric, timestamptz) from anon;

-- La fila cuenta lo que todavía hay que preparar: pendiente, aceptado y espera.
create or replace function public.estado_cafe() returns table (en_fila int, espera_min int)
language sql stable security definer set search_path = public as $$
  select count(*)::int, (count(*) filter (where pc.hora_asignada <= now() + interval '30 minutes') * 2)::int
  from public.pedidos_cafe pc
  where pc.estado in ('pendiente', 'aceptado', 'espera') and pc.hora_asignada >= now() - interval '15 minutes'
    and (pc.hora_asignada at time zone 'America/Hermosillo')::date = (now() at time zone 'America/Hermosillo')::date;
$$;
grant execute on function public.estado_cafe() to anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Pedidos de pan
-- ---------------------------------------------------------------------
create table if not exists public.pedidos_pan (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,   -- null en encargos de mostrador
  origen text not null default 'web' check (origen in ('web', 'mostrador')),
  folio int,                                                      -- folio corto de la comandera (mostrador)
  tipo text not null check (tipo in ('restaurante', 'canasta')),
  nombre text not null,
  telefono text not null default '',                              -- opcional en pan
  email text,                                                     -- se copia de la cuenta del cliente
  -- [{ "pan": "baguette", "nombre": "Baguette", "cantidad": 24, "importe": 1400 }]
  items jsonb not null check (jsonb_typeof(items) = 'array'),
  entrega text not null check (entrega in ('domicilio', 'pickup')),
  ciudad text,
  codigo_postal text,
  direccion text not null default '',
  fecha date not null,
  hora text,                                                      -- hora de pick up si el cliente la eligió (ej. "11:30")
  subtotal numeric(10,2) not null check (subtotal >= 0),
  comision numeric(10,2) not null default 0 check (comision >= 0),
  total numeric(10,2) not null check (total >= 0),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aceptado', 'entregado', 'cancelado')),
  pagado boolean not null default false,
  pago_metodo text check (pago_metodo is null or pago_metodo in ('efectivo', 'tarjeta')),
  pagado_en timestamptz,
  aceptado_en timestamptz,
  entregado_en timestamptz,
  cancelado_en timestamptz,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index if not exists pedidos_pan_fecha_idx on public.pedidos_pan (fecha);
create index if not exists pedidos_pan_usuario_idx on public.pedidos_pan (user_id, creado_en desc);
alter table public.pedidos_pan enable row level security;

drop policy if exists "pan: ver propios o staff" on public.pedidos_pan;
create policy "pan: ver propios o staff" on public.pedidos_pan
  for select using (auth.uid() = user_id or public.es_staff());
drop policy if exists "pan: staff crea encargos" on public.pedidos_pan;
create policy "pan: staff crea encargos" on public.pedidos_pan
  for insert with check (public.es_staff() and origen = 'mostrador');
drop policy if exists "pan: staff actualiza" on public.pedidos_pan;
create policy "pan: staff actualiza" on public.pedidos_pan
  for update using (public.es_staff()) with check (public.es_staff());
drop policy if exists "pan: admin borra" on public.pedidos_pan;
create policy "pan: admin borra" on public.pedidos_pan for delete using (public.es_admin());

create or replace function public.tocar_actualizado() returns trigger language plpgsql as $$
begin new.actualizado_en := now(); return new; end; $$;
drop trigger if exists pedidos_pan_actualizado on public.pedidos_pan;
create trigger pedidos_pan_actualizado before update on public.pedidos_pan
  for each row execute function public.tocar_actualizado();

-- RPC para la app de la página web. Valida las reglas de entrega y calcula la
-- comisión con calcular_comision(). El subtotal lo manda la app (precios de catálogo).
-- Reglas acordadas con la app de pedidos de pan:
--   · Teléfono opcional (el correo de la cuenta se copia al pedido).
--   · Domicilio con código postal: ciudad y comisión salen de calcular_comision; fuera de zona no se acepta.
--   · Domicilio sin código postal: solo restaurantes de Mexicali (p_ciudad = 'Mexicali').
--     En San Luis Río Colorado el código postal es obligatorio.
--   · En Mexicali la Canasta no va a domicilio (puntos de entrega, próximamente): solo pick up.
--   · Mexicali lunes y jueves; San Luis martes y viernes; pick up de lunes a sábado, de 10:00 a 17:00.
drop function if exists public.crear_pedido_pan(text, text, text, jsonb, text, text, text, date, text, numeric);
create or replace function public.crear_pedido_pan(
  p_tipo text, p_nombre text, p_telefono text, p_items jsonb, p_entrega text,
  p_codigo_postal text, p_ciudad text, p_direccion text, p_fecha date, p_hora text, p_subtotal numeric)
returns table (id uuid, comision numeric, total numeric)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  zona constant text := 'America/Hermosillo';
  msg_canasta constant text := 'En Mexicali la Canasta se entrega en puntos de entrega (próximamente). Elige pick up.';
  v_uid uuid := auth.uid();
  v_tel text := regexp_replace(coalesce(p_telefono, ''), '[^0-9+]', '', 'g');
  v_cp text := nullif(trim(coalesce(p_codigo_postal, '')), '');
  v_hora text := nullif(trim(coalesce(p_hora, '')), '');
  v_hoy date := (now() at time zone zona)::date;
  v_email text;
  v_piezas int;
  v_dow int;
  v_ciudad text;
  v_comision numeric := 0;
  v_id uuid;
  r record;
begin
  if v_uid is null then raise exception 'Debes iniciar sesión para hacer tu pedido.'; end if;
  select u.email into v_email from auth.users u where u.id = v_uid;
  if p_tipo not in ('restaurante', 'canasta') then raise exception 'Tipo de pedido no válido.'; end if;
  if coalesce(trim(p_nombre), '') = '' then raise exception 'Escribe tu nombre o el de tu negocio.'; end if;
  if v_tel <> '' and length(regexp_replace(v_tel, '[^0-9]', '', 'g')) < 10 then raise exception 'Escribe un celular válido (10 dígitos) o déjalo vacío.'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Tu pedido está vacío.'; end if;
  if jsonb_array_length(p_items) > 40 then raise exception 'El pedido tiene demasiados productos.'; end if;
  if exists (select 1 from jsonb_array_elements(p_items) i where coalesce((i ->> 'cantidad')::int, 0) <= 0) then
    raise exception 'Hay un pan con cantidad no válida.'; end if;
  select coalesce(sum((i ->> 'cantidad')::int), 0) into v_piezas from jsonb_array_elements(p_items) i;
  if p_tipo = 'restaurante' and v_piezas < 12 then raise exception 'El pedido para restaurante es de mínimo 12 piezas.'; end if;
  if p_tipo = 'canasta' and (v_piezas < 1 or v_piezas > 12) then raise exception 'La Canasta es de 1 a 12 piezas.'; end if;
  if p_subtotal is null or p_subtotal < 0 then raise exception 'El total no es válido.'; end if;
  if p_entrega not in ('domicilio', 'pickup') then raise exception 'Elige entrega a domicilio o pick up.'; end if;
  if p_fecha is null or p_fecha < v_hoy + 2 then raise exception 'Los pedidos se hacen con 2 días de anticipación.'; end if;
  if p_fecha > v_hoy + 60 then raise exception 'Elige una fecha más cercana.'; end if;
  v_dow := extract(isodow from p_fecha);

  if p_entrega = 'pickup' then
    if v_dow = 7 then raise exception 'Los domingos no hay pick up.'; end if;
    if v_hora is not null then
      if v_hora !~ '^[0-9]{1,2}:[0-9]{2}$' then raise exception 'La hora de pick up no es válida.'; end if;
      if v_hora::time < time '10:00' or v_hora::time > time '17:00' then raise exception 'El pick up es de 10:00 a 17:00.'; end if;
    end if;
    v_ciudad := nullif(trim(coalesce(p_ciudad, '')), '');
  else
    if v_cp is not null then
      select * into r from public.calcular_comision(v_cp, p_subtotal);
      if r is null or not r.disponible then raise exception 'No entregamos en ese código postal. Elige pick up.'; end if;
      v_ciudad := r.ciudad;
      if p_tipo = 'canasta' then v_comision := coalesce(r.comision, 0); end if;  -- restaurante: envío gratis
    elsif coalesce(p_ciudad, '') ilike '%mexicali%' then
      if p_tipo = 'canasta' then raise exception '%', msg_canasta; end if;
      v_ciudad := 'Mexicali';                                                    -- restaurante de Mexicali sin código postal
    else
      raise exception 'Escribe tu código postal para la entrega a domicilio.';
    end if;
    if v_ciudad ilike '%mexicali%' and p_tipo = 'canasta' then raise exception '%', msg_canasta; end if;
    if v_ciudad ilike '%mexicali%' and v_dow not in (1, 4) then raise exception 'En Mexicali entregamos lunes y jueves.'; end if;
    if v_ciudad ilike '%san luis%' and v_dow not in (2, 5) then raise exception 'En San Luis entregamos martes y viernes.'; end if;
  end if;

  if (select count(*) from public.pedidos_pan pp where pp.user_id = v_uid and pp.estado = 'pendiente') >= 5 then
    raise exception 'Ya tienes 5 pedidos pendientes. Espera a que los confirmen.'; end if;

  insert into public.pedidos_pan (user_id, origen, tipo, nombre, telefono, email, items, entrega, ciudad, codigo_postal,
                                  direccion, fecha, hora, subtotal, comision, total)
  values (v_uid, 'web', p_tipo, trim(p_nombre), v_tel, v_email, p_items, p_entrega, v_ciudad, v_cp,
          coalesce(trim(p_direccion), ''), p_fecha, v_hora, p_subtotal, v_comision, p_subtotal + v_comision)
  returning pedidos_pan.id into v_id;
  return query select v_id, v_comision, p_subtotal + v_comision;
end; $$;
revoke execute on function public.crear_pedido_pan(text, text, text, jsonb, text, text, text, text, date, text, numeric) from anon;
grant execute on function public.crear_pedido_pan(text, text, text, jsonb, text, text, text, text, date, text, numeric) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Ventas de mostrador (café y pan de vitrina)
-- ---------------------------------------------------------------------
create table if not exists public.ventas_mostrador (
  id uuid primary key default gen_random_uuid(),
  folio int,
  area text not null check (area in ('cafe', 'pan')),
  cliente text not null default '',
  items jsonb not null check (jsonb_typeof(items) = 'array'),
  total numeric(10,2) not null check (total >= 0),
  estado text not null default 'aceptado' check (estado in ('aceptado', 'listo', 'entregado', 'cancelado')),
  pago_metodo text not null check (pago_metodo in ('efectivo', 'tarjeta')),
  pago_recibido numeric(10,2),
  cambio numeric(10,2),
  pagado_en timestamptz not null default now(),
  listo_en timestamptz,
  entregado_en timestamptz,
  cancelado_en timestamptz,
  cancel_monto numeric(10,2),
  creado_por uuid default auth.uid() references auth.users (id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index if not exists ventas_mostrador_fecha_idx on public.ventas_mostrador (creado_en desc);
alter table public.ventas_mostrador enable row level security;
drop policy if exists "mostrador: staff ve" on public.ventas_mostrador;
create policy "mostrador: staff ve" on public.ventas_mostrador for select using (public.es_staff());
drop policy if exists "mostrador: staff crea" on public.ventas_mostrador;
create policy "mostrador: staff crea" on public.ventas_mostrador for insert with check (public.es_staff());
drop policy if exists "mostrador: staff actualiza" on public.ventas_mostrador;
create policy "mostrador: staff actualiza" on public.ventas_mostrador for update using (public.es_staff()) with check (public.es_staff());
drop trigger if exists ventas_mostrador_actualizado on public.ventas_mostrador;
create trigger ventas_mostrador_actualizado before update on public.ventas_mostrador
  for each row execute function public.tocar_actualizado();

-- ---------------------------------------------------------------------
-- 5. Tiempo real
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pedidos_pan') then
    alter publication supabase_realtime add table public.pedidos_pan;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ventas_mostrador') then
    alter publication supabase_realtime add table public.ventas_mostrador;
  end if;
end $$;

commit;

-- =====================================================================
-- DESPUÉS: dar de alta al barista
-- 1. Crea la cuenta del barista (Authentication → Users → Add user) con su correo y contraseña.
-- 2. Ejecuta, con su correo:
--      insert into public.staff (user_id) select id from auth.users where email = 'correo-del-barista@ejemplo.com';
-- =====================================================================
