# Villa-R-stica
Industria panificadora para restaurantes de alta cocina. 

## Comandera

`comandera/index.html` es la comandera oficial para el personal de la cafetería:

- **Pedido**: mesa o para llevar, cafés de la carta oficial con temperatura, leche, toppings y notas, y productos de panadería configurables.
- **Barra**: comandas en tiempo real con estados (Nueva → Preparando → Lista → Entregada) y aviso en rojo si llevan más de 10 min.
- **Cobro**: cuentas abiertas agrupadas por mesa, propina, efectivo/tarjeta/transferencia, cálculo de cambio e impresión de ticket de 80 mm.
- **Caja**: ventas del día, ticket promedio, totales por método, más vendidos, exportación CSV y cierre de día.

Los datos se guardan en el dispositivo (localStorage). Si abres la Barra en otra pestaña del mismo equipo, se sincroniza sola (`comandera/index.html#barra`).
