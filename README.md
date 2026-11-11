# Villa-R-stica
Industria panificadora para restaurantes de alta cocina. 

## Comandera

Prototipo de la comandera oficial en `comandera/` (abre `comandera/index.html`). La definición completa está en [`comandera/ESPECIFICACION.md`](comandera/ESPECIFICACION.md).

- **Tablet 1 · Comandera rápida** (`rapida.html`): ventas de café y pan en el mostrador. Se puede voltear al cliente (modo cliente con PIN del barista).
- **Tablet 2 · Pedidos** (`pedidos.html`): pedidos de la web y del mostrador, aviso con sonido, WhatsApp con un toque, pedidos perdidos y pan agrupado por día de entrega.
- **Administración** (`admin.html`): corte de caja, menú, precios, agotados y pedidos de pan.

Por ahora los datos se guardan en el navegador y se sincronizan entre pestañas del mismo equipo. El siguiente paso es conectarlo a Supabase. Precios de ejemplo · PIN `1234` · contraseña `villa`.
