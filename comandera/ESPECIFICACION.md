# Comandera oficial · Villa Rústica

Resumen de la entrevista de definición (noviembre 2026). Este documento describe **qué** debe hacer la comandera. El prototipo en esta carpeta es la primera versión visual de ello.

## 1. Objetivo del proceso

Que el barista, trabajando solo, pueda **recibir, preparar, cobrar y entregar** todos los pedidos de Villa Rústica desde dos tablets:

- Pedidos de **café** que llegan de la web y ventas de café en el **mostrador**.
- Pedidos de **pan** que llegan de la web (restaurantes y Canastas), **encargos** de pan en el mostrador y venta de pan de **vitrina**.

Además, que el dueño controle **menú, precios, agotados y corte de caja** desde una administración propia, conectada a Supabase.

## 2. Usuarios

| Quién | Dónde | Qué hace |
|---|---|---|
| **Barista** (está solo en la hora pico) | Tablet 1 y Tablet 2 | Captura, cobra, prepara y entrega. Acepta pedidos. |
| **Cliente en mostrador** | Tablet 1, volteada hacia él | Arma su propio pedido (modo cliente). |
| **Chris (administrador)** | Administración | Menú, precios, agotados, corte de caja y pedidos de pan con problemas. |

## 3. Flujo paso a paso

### Tablet 1 · Comandera rápida (en el mostrador, se puede voltear al cliente)
Tiene una pestañita en la esquina para cambiar entre **Cafetería** y **Panadería**.

**Cafetería:**
1. El barista o el cliente arma los cafés con el **mismo armador de la web** (café, frío o caliente, leche, toppings y cantidad).
2. Se captura el **nombre** del cliente.
3. Si lo armó el cliente, toca **Listo** y ve "Pasa a pagar con el barista". El barista voltea la tablet y mete su **PIN**.
4. El barista **cobra en ese momento**: en efectivo (la tablet calcula el cambio) o con tarjeta en la terminal.
5. **Hasta que está cobrado**, el pedido aparece en la Tablet 2.

**Panadería:**
- **Vitrina:** se eligen las piezas, se cobra y el cliente se las lleva. No aparece en el listado.
- **Encargo:** con el mismo sistema que la app de pedidos de pan. Restaurante con mínimo 12 piezas y precio de docena automático, o Canasta de 1 a 12 piezas. Se capturan nombre, celular, tipo, panes y cantidades, entrega o pick up, ciudad y fecha. Se guarda **ya aceptado** y se manda el WhatsApp de confirmación. Se cobra al entregar o al recoger.

### Tablet 2 · Pedidos (junto a la cafetera)
También tiene la pestañita para cambiar entre **Cafetería** y **Panadería**. **Suena un aviso** cuando llega un pedido nuevo.

**Distribución (revisión 2):**
- **Cafetería:** dos columnas. A la izquierda, **Mostrador**. A la derecha, **Pick up** (pedidos de la web). Los pedidos por aceptar y los que esperan respuesta van en **beige**. Al aceptarlos se vuelven **blancos**, como las comandas normales.
- **Panadería:** dos columnas, **Por confirmar** (beige) y **Confirmados** (blancos, por día de entrega y con el total a hornear de lo confirmado).
- **Panadería · Entregados:** solo aparecen los pedidos ya entregados, cada uno con un interruptor **Pagado / Sin pagar**. Las entregas a domicilio se marcan "Entregado" sin cobrar. Cuando el repartidor llega con el dinero, se marcan como pagadas. El pick up se cobra al entregar.
- Los panes, sus precios y sus ilustraciones son los mismos de la app "La Villa Rústica Pedidos". Cada docena completa de un mismo pan se cobra a precio de docena.

**Pedido de café desde la web:**
1. Llega el pedido y suena el aviso.
2. El barista lo **acepta**, aunque sea para más tarde. Se abre WhatsApp con el mensaje ya escrito y el barista toca Enviar.
3. Lo prepara y lo marca **Listo**. Se abre WhatsApp con el mensaje "ya puedes pasar".
4. La clienta llega y **paga al recoger** (efectivo con cambio o tarjeta).
5. Se marca **Entregado**.

**Si falta algo** (leche, topping o disponibilidad):
1. El barista **rechaza** con un motivo y manda un WhatsApp con una alternativa.
2. El pedido queda **arriba** del listado como **"Esperando respuesta"**, en otro color.
3. Si la clienta acepta, el barista **edita** el pedido y lo acepta. Si no contesta o dice que no, el barista lo manda **a mano** a **Pedidos perdidos**.

**Pedido de pan desde la web:**
1. Llega el pedido y suena el aviso.
2. El barista lo **acepta**. Se abre WhatsApp con la confirmación.
3. Se hornea y se entrega, o el cliente lo recoge.
4. Se **cobra al entregar o al recoger** y se marca **Entregado**.

El barista **no rechaza ni edita** pedidos de pan. Eso lo resuelve Chris con el cliente.

## 4. Inputs necesarios

- **Pedidos web de café** (Supabase): nombre, celular, cafés, hora de recogida y, a futuro, si ya viene pagado.
- **Pedidos web de pan** (Supabase): cliente, celular, tipo, panes, ciudad o CP, entrega o pick up, y fecha.
- **Captura en mostrador:** lo que el barista o el cliente arman en la Tablet 1.
- **Catálogo** (Supabase, lo edita solo el administrador): cafés, leches, toppings, panes, precios y agotados.

## 5. Outputs esperados

- **Listado de café** ordenado por hora de recogida, con estados: Nuevo, Esperando respuesta, En preparación, Listo y Entregado. Tiene pestañas aparte para **Pedidos perdidos** y **Entregados**.
- **Listado de pan** agrupado **por día de entrega** y, dentro de cada día, por **Mexicali / San Luis / Pick up**, con el **total de piezas por tipo de pan** de cada día.
- **Mensajes de WhatsApp** ya redactados, que se abren con un toque.
- **Corte de caja** (solo en la administración): ventas de Cafetería y de Panadería, efectivo y tarjeta, pedidos web y de mostrador, pedidos perdidos, **cancelaciones** y productos más vendidos.

### Mensajes aprobados
**Café, aceptado:** "¡Hola, María! ☕ Recibimos tu pedido: Latte con leche de avena, para las 7:15. Ya lo estamos preparando. — Villa Rústica"

**Café, listo:** "¡María, tu café ya está listo! 🌿 Pasa por él cuando gustes. Total a pagar: $XX. Te esperamos."

**Café, falta algo:** "Hola, María 🌾 Hoy se nos terminó la leche de avena. ¿Te preparamos tu latte con leche de almendra? Respóndenos y lo tenemos listo para las 7:15."

**Pan, restaurante:** "Buen día, Restaurante La Terraza. Confirmamos su pedido en Villa Rústica: • 36 Baguette francés (3 docenas). Entrega: jueves 13 de noviembre, Mexicali. Le confirmaremos la hora de entrega por este medio. Total a pagar al recibir: $XX (efectivo). Gracias por su preferencia."

**Pan, Canasta:** "Hola, Laura. Confirmamos tu Canasta de pan: • 4 Hogaza de masa madre, 2 Baguette. Recoger: sábado 15 de noviembre, de 10:00 a 17:00, en Villa Rústica. Total a pagar al recoger: $XX. ¡Gracias!"

No hay mensaje de "va en camino": la hora de entrega se confirma aparte.

## 6. Reglas principales

- El listado de café va por **hora de recogida**. Los pedidos de mostrador se toman como "para ahora". Los que esperan respuesta van **arriba**.
- Un pedido se ve **atenuado** si faltan más de **30 minutos** para su hora. Se puede aceptar en cuanto llega.
- Un pedido de la web se marca **en rojo** **30 minutos después** de su hora de recogida si no se ha entregado.
- Reglas del armador de café: "sin leche" solo en espresso y americano. Frío o caliente solo en latte y americano.
- Pan: restaurante con mínimo de 12 piezas y precio de docena. Canasta de 1 a 12 piezas. Entregas en Mexicali lunes y jueves, en San Luis martes y viernes, siempre con 48 h de anticipación. Pick up de lunes a sábado, de 10:00 a 17:00.
- Formas de pago: **efectivo** (con cálculo de cambio) y **tarjeta** en terminal externa. Mercado Pago llegará después.
- **Acceso:** cada tablet tiene la sesión de la cuenta **Barista** abierta. Para salir del modo cliente y para cobrar hace falta un **PIN de 4 dígitos**. La administración solo se abre con la **cuenta de administrador**.

## 7. Excepciones y casos límite

- **La clienta no llega:** el pedido se pone en rojo y el barista lo manda a **Pedidos perdidos** sin cobrarlo.
- **Falta un ingrediente:** el pedido pasa a "Esperando respuesta". El barista lo edita y lo acepta, o lo manda a perdidos (a mano, sin tiempo límite).
- **Error en una venta ya cobrada:** se **cancela con devolución** y se captura de nuevo. No se editan ventas cobradas. Toda cancelación queda **registrada** y aparece en el corte.
- **Pedido de pan que no se puede cumplir:** el barista solo acepta. Chris lo arregla con el cliente y, si hace falta, lo cancela desde la administración.

## 8. Criterios de calidad

- El barista solo puede atender cada pedido con **pocos toques** y sin perder de vista la fila de café.
- Ningún pedido se queda sin atender: hay aviso sonoro, el pedido llega primero y los atrasados se ponen en rojo.
- El corte de caja **cuadra** con el efectivo de la caja y con la terminal.
- Un cliente con la tablet volteada **no puede** ver ventas, la caja ni la administración.

## 9. Riesgos o ambigüedades pendientes

- **Precios y menú reales:** los precios del café en pesos y los panes con sus precios definitivos siguen pendientes. El prototipo usa **precios de ejemplo**.
- **Supabase:** la migración 02 de pedidos de café no se ha ejecutado. Hay que conectar el prototipo a las tablas reales, a la autenticación y a Realtime para que las dos tablets se sincronicen.
- **Rechazo por "sin disponibilidad":** por ahora también pasa a "Esperando respuesta". Falta confirmar si debería ir directo a perdidos.
- **Canasta con entrega en Mexicali:** depende de los puntos de entrega, que aún no se definen. En el prototipo está deshabilitada.
- **Comisión de la Canasta por CP:** el prototipo aplica el 10 % en San Luis. Las comisiones de Mexicali están por definir.
- **Pago con Mercado Pago:** cuando exista, el listado debe mostrar "Pagado en app" y no pedir cobro al entregar.
- **Pedidos para un día que ya pasó:** se muestran como atrasados. Falta definir quién los cierra.

## 10. Siguiente acción recomendada

1. Revisar el **prototipo** en las dos tablets y ajustar el diseño.
2. Definir los **precios y el menú reales** y cargarlos desde la administración.
3. Conectar con **Supabase**: tablas de pedidos y catálogo, cuentas de Barista y de Administrador, y Realtime entre tablets.

## 11. Conexión con la página web (Supabase)

- `config.js` tiene la dirección del proyecto y la clave pública, que es la misma que usan las apps de la página web.
- `nube.js` lee y guarda en Supabase y recibe los pedidos en tiempo real:
  - **Café de la web:** tabla `pedidos_cafe`, que ya existe. En la base de datos el estado "Por aceptar" se llama `pendiente`.
  - **Pan de la web y encargos de mostrador:** tabla nueva `pedidos_pan`. La app de pan de la página la llena con la RPC `crear_pedido_pan`.
  - **Ventas de mostrador** (café y pan de vitrina): tabla nueva `ventas_mostrador`, para que las dos tablets las compartan.
- Cada tablet inicia sesión una vez con la cuenta del barista (tabla `staff`). La administración pide una cuenta de administrador.
- `supabase/03_comandera.sql` es la migración necesaria. **No se ha ejecutado:** la tiene que revisar y ejecutar Chris.
- Si un pedido en "Esperando respuesta" se resuelve, el barista lo edita y pasa directo a `aceptado`, en el mismo pedido. "Perdido" libera la hora.
- Sin configuración, o abriendo una pantalla con `?demo`, la comandera funciona en modo demostración con datos locales.
- **Pendiente:**
  - El menú, los precios, los agotados y el PIN todavía se guardan en cada tablet por separado. Falta pasarlos a Supabase para que lo que cambies en Administración llegue a las tablets y a la página web.
  - La comandera tiene que publicarse en una dirección web, por ejemplo GitHub Pages, para abrirla en las tablets.
