# Sirtech POS — punto de venta completo

Sistema comercial para tiendas, colmados, farmacias y ferreterías: **caja, facturación, clientes, productos, almacén,
inventario y compras**. La **contabilidad** (asientos, reportes DGII, bancos, estados financieros) la lleva el
**sistema financiero** (`repositorios/modulo-financiero`, rama `main` de `pos-modulo-financiero`). El administrador y
el contador tienen enlaces hacia allá.

Cada cosa que pasa en el POS ya es un documento contable:
- una venta de caja o una factura es una factura con NCF, ITBIS, salida de inventario y asiento;
- una compra es una factura de compra con su entrada de inventario a costo promedio y su cuenta por pagar;
- un cobro es un cobro con su asiento;
- un ajuste es un ajuste de inventario con su asiento.

El frontend **no calcula impuestos ni saldos**: muestra lo que devuelve el backend. Las cifras de la caja y de los
formularios son una vista previa; el servidor recalcula y manda.

Stack: Vue 3 (`<script setup lang="ts">`), Vite, TypeScript estricto, Pinia, Vue Router, Axios, Tailwind 4 y decimal.js.

---

## Roles: cada uno ve solo su área

| Rol | Qué ve | Entra a |
|---|---|---|
| **Cajero** | Caja (vender, cobrar, devolver, cerrar turno) y **cobro de facturas pendientes**. Consulta productos y existencias. | Caja |
| **Vendedor** | **Facturas** (crearlas a crédito o a empresas) y **clientes**. Consulta productos y existencias. No toca la caja ni el almacén. | Facturas |
| **Almacén** | **Productos** (crear y editar), **inventario** (existencias, kárdex, ajustes), **compras** (entrada de mercancía) y **proveedores**. No vende. | Inventario |
| **Supervisor** (Aprobador) | Caja, facturas, clientes, consultas de almacén, **turnos** y **ventas de caja**. Anula facturas y autoriza con su PIN. | Inicio |
| **Contador** | Todo el POS: configuración, promociones y compras. Además, **enlaces a la contabilidad**. | Inicio |
| **Administrador** | Lo mismo que el contador, más **usuarios**. | Inicio |
| Consulta / Auditor | No usan el POS: solo el sistema financiero. | «Sin acceso» |

El backend aplica la misma regla: los roles de tienda (Cajero, Vendedor, Almacén) **solo entran a rutas del punto de
venta**. Cualquier otra ruta del sistema financiero les responde 403. El menú y las rutas del frontend solo ordenan la
experiencia; quien bloquea de verdad es el backend.

**Autorización de supervisor.** Si un cajero o un vendedor hace algo que necesita permiso (descuento mayor al
permitido, anulación, devolución, salida de efectivo, abrir la gaveta, venta a crédito), el backend responde
`APPROVAL_REQUIRED`. La pantalla pide entonces el correo y el PIN de un supervisor y reintenta. Cada supervisor fija su
PIN en «Mi PIN de supervisor» (menú lateral).

## Pantallas

| Sección | Ruta | Qué hace |
|---|---|---|
| Inicio | `/inicio` | Vendido hoy, por cobrar, vencidas, productos agotados y accesos rápidos según el rol |
| **Caja** | `/caja` | Pantalla completa para el mostrador: terminal y turno, escáner y categorías, promociones, cliente y comprobante, cobro mixto, suspender (F9) y recuperar (F10), ventas y devoluciones, efectivo de la gaveta, cierre ciego y ticket de 80 mm |
| **Facturas** | `/facturas`, `/facturas/nueva`, `/facturas/:id` | Todas las ventas (caja incluida). Nueva factura con NCF B01/B02/B14/B15/E31/E32, vencimiento por los días de crédito del cliente y descuento con PIN. El detalle permite **cobrar** (total o parcial, efectivo, tarjeta, transferencia o cheque), **anular** con motivo DGII e **imprimir** en tamaño carta |
| **Clientes** | `/clientes`, `/clientes/:id` | Lista con lo que debe cada uno, alta y edición (RNC o cédula, crédito, comprobante que pide). Ficha con sus facturas y botón de factura nueva |
| **Productos** | `/productos` | Precio, ITBIS de venta y compra, control de existencias, categoría de la caja, códigos de barra y si aparece en la caja. Categorías con color |
| **Inventario** | `/inventario`, `/inventario/:id` | Existencias con costo promedio y valor, ajustes (conteo, merma, existencia inicial) con su anulación, y kárdex por producto |
| **Compras** | `/compras`, `/compras/nueva`, `/compras/:id` | Factura del proveedor con su NCF (o B11 si es informal): la mercancía entra al inventario a ese costo |
| **Proveedores** | `/proveedores` | Alta y edición, y lo que se les debe |
| Turnos de caja | `/turnos`, `/turnos/:id` | Reporte X (abierto) y Z (cerrado) de cada turno |
| Ventas de caja | `/reportes` | Ventas por día, caja, cajero y producto |
| Promociones | `/promociones` | %, lleva X paga Y y precio especial; fechas, días y horario |
| Configuración | `/configuracion` | Cliente por defecto, comprobantes, descuento sin PIN, cuenta de sobrantes y faltantes, y terminales |
| Usuarios | `/usuarios` | Crear usuarios con su rol, cambiar rol, activar o desactivar y poner clave nueva (pide la clave del administrador) |
| Contabilidad | `/contabilidad` | Enlaces al sistema financiero: panel, estados financieros, asientos, DGII 606/607/608, NCF, bancos y cuentas por cobrar y pagar |

## Arrancar en desarrollo

Se necesita el backend financiero corriendo (por defecto en `http://localhost:3000`) **con sus migraciones al día**
(`./node_modules/.bin/prisma migrate deploy` dentro de `modulo-financiero`).

```bash
npm install
npm run dev            # http://localhost:5174
```

En desarrollo, el frontend llama a `/api/...` y Vite lo pasa al backend sin el prefijo `/api`, igual que el proxy del
frontend Angular. Así no hace falta abrir CORS. Otro backend: `API_PROXY_TARGET=http://localhost:3001 npm run dev`.

Variables (`.env.example`):

| Variable | Para qué | Por defecto |
|---|---|---|
| `VITE_API_URL` | Ruta de la API | `/api` |
| `VITE_FINANCE_URL` | Dirección del sistema financiero, para los enlaces de contabilidad | `http://localhost:4200` |

**Producción:** `npm run build` genera `dist/`. Sírvelo con nginx y publica `/api/` hacia el backend, quitando el
prefijo, como en `deploy/nginx.conf.example` del módulo financiero. Pon `VITE_FINANCE_URL` con la dirección pública del
sistema contable.

## Antes del primer uso

En el **sistema financiero**, una sola vez:
1. **Configuración inicial:** plan de cuentas, impuestos y diarios.
2. **Cuentas automáticas:** cuenta de inventario, costo de ventas y ajustes de inventario. Sin ellas, compras y ajustes
   responden «Falta configurar en Configuración contable».
3. **NCF:** secuencias **B02** (consumo), **B01** (crédito fiscal), **B04** (notas de crédito: devoluciones de la caja)
   y **B11** (si compras a informales).
4. **Bancos y cajas:** la caja de efectivo y las cuentas bancarias, cada una con su cuenta contable.

En el **POS**, como administrador:
1. En **Configuración**, pulsa «Preparar», elige una cuenta de **gasto** para sobrantes y faltantes y crea la terminal.
2. En **Productos**, crea las categorías y los productos (precio, ITBIS, «Controla existencias», código de barras).
3. En **Compras**, registra la mercancía que tienes, o haz un **ajuste de existencia inicial** en Inventario.
4. En **Usuarios**, crea a cajeros, vendedores y almacén. Cada supervisor fija su PIN en «Mi PIN de supervisor».

## Pruebas

```bash
npm run test     # 56 pruebas
npm run build    # vue-tsc estricto + build
```

Las pruebas cubren:
- la capa de API (caja, tienda y usuarios);
- el motor de precios (copia del backend);
- el login con 2FA y la entrada de cada rol a su área;
- el cobro en la caja y el cobro de facturas (no se cobra más que el saldo);
- la autorización de supervisor;
- las rutas por rol.

`src/utils/pricing.ts` es copia del motor de precios del backend (`src/verticals/pos/pricing.ts`); si cambia allá, hay
que cambiarlo aquí, y `tests/pricing.spec.ts` lo detecta.

## Pendiente o fuera de alcance

- **Venta sin conexión** (el backend aún no la tiene).
- **Impresión directa** a impresora térmica y apertura de gaveta por hardware: hoy se imprime desde el navegador
  (ticket de 80 mm y factura en carta).
- **Pagos a proveedores** y anulación de cobros: se hacen en el sistema financiero (Cobros y pagos).
- **Cotizaciones**, **notas de crédito manuales** fuera de la caja, **listas de precio** y **varios almacenes**.
- **Exportar** listas y reportes a Excel o PDF.
- El campo de fecha usa el del navegador: en un navegador en inglés sale mm/dd/aaaa.
- El sistema financiero y el POS piden la sesión por separado: entrar una sola vez a los dos requiere servirlos
  bajo el mismo dominio y compartir la sesión.
