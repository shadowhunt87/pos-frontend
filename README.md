# Sirtech POS — frontend del punto de venta

Punto de venta para comercios (colmados, tiendas, farmacias…), separado del taller. Trabaja contra la API `/pos` del
**backend financiero** (`repositorios/modulo-financiero`, `src/verticals/pos`): cada venta es una factura del sistema
contable, con su NCF, su ITBIS, su inventario y su asiento. Este frontend solo muestra, captura y envía. Los montos, los
permisos y las reglas los decide el backend.

Stack: Vue 3 (`<script setup lang="ts">`), Vite, TypeScript estricto, Pinia, Vue Router, Axios, Tailwind 4 y decimal.js.
Es el mismo stack y el mismo sistema de diseño del `taller-frontend`, con el acento en verde azulado.

## Pantallas

| Pantalla | Ruta | Quién |
|---|---|---|
| Entrar (con verificación en dos pasos si el usuario la tiene) | `/login` | todos |
| **Caja**: terminal, turno, catálogo y escáner, promociones, descuentos, cliente y comprobante, cobro mixto, suspender (F9) y recuperar (F10), ventas y devoluciones, anulación, efectivo de la gaveta, cierre ciego y ticket de 80 mm | `/caja` | Cajero, Aprobador, Contador, Administrador |
| Turnos de caja y su reporte X/Z | `/admin/turnos` | Aprobador, Contador, Administrador |
| Ventas por día, caja, cajero y producto | `/admin/reportes` | Aprobador, Contador, Administrador |
| Productos en caja (categorías, visibilidad, códigos de barra) | `/admin/productos` | Contador, Administrador |
| Promociones (% , lleva X paga Y, precio especial; fechas, días y horario) | `/admin/promociones` | Contador, Administrador |
| Configuración (ajustes y terminales) | `/admin/configuracion` | Contador, Administrador |
| Mi PIN de supervisor (en el menú de administración) | — | Aprobador, Contador, Administrador |

Cuando un cajero hace algo que necesita permiso (descuento mayor al permitido, anulación, devolución, salida de efectivo,
abrir la gaveta, venta a crédito), el backend responde `APPROVAL_REQUIRED`. La caja pide entonces el correo y el PIN de un
supervisor y reintenta una sola vez. Atajos: F2 buscar, F9 suspender, F10 suspendidas, F12 cobrar y Enter para una venta nueva.

## Arrancar en desarrollo

Necesitas el backend financiero corriendo (por defecto en `http://localhost:3000`).

```bash
npm install
npm run dev            # http://localhost:5174
```

En desarrollo, el frontend llama a `/api/...` y Vite lo pasa al backend sin `/api`, igual que el proxy del frontend
Angular. Así no hace falta abrir CORS. Para usar otro backend:

```bash
API_PROXY_TARGET=http://localhost:3001 npm run dev
```

`.env` (opcional; ver `.env.example`): `VITE_API_URL=/api`.

**Producción:** `npm run build` genera `dist/`. Sírvelo con nginx y publica `/api/` hacia el backend, quitando el
prefijo, como en `deploy/nginx.conf.example` del módulo financiero. Si el frontend vive en otro dominio, pon
`VITE_API_URL=https://api.tudominio.com` y agrega ese origen a `CORS_ORIGINS` del backend.

## Antes del primer uso (en el sistema financiero)

1. La base debe tener las migraciones del POS: `npx prisma migrate deploy` en `modulo-financiero`.
2. En el sistema financiero:
   - una **caja** de efectivo con cuenta contable (Bancos y caja);
   - las **cuentas bancarias** para tarjeta y transferencia;
   - **productos** con precio de venta e ITBIS;
   - secuencias de NCF **B02** (ventas), **B01** (crédito fiscal) y **B04** (notas de crédito, que usan las devoluciones);
   - usuarios con rol **Cajero**.
3. En este frontend, entra como administrador o contador:
   1. En **Configuración**, pulsa «Preparar», elige la cuenta de sobrantes y faltantes (una de **gasto**) y crea la terminal.
   2. En **Productos en caja**, define categorías y códigos de barra.
   3. Cada supervisor fija su PIN en «Mi PIN de supervisor».

## Pruebas

```bash
npm run test     # 43 pruebas: capa de API, motor de precios, login (con 2FA), cobro, autorización de supervisor y rutas por rol
npm run build    # vue-tsc estricto + build
```

`src/utils/pricing.ts` es copia del motor de precios del backend (`src/verticals/pos/pricing.ts`). Si cambia allá, hay
que cambiarlo aquí, y `tests/pricing.spec.ts` lo detecta. Aunque no coincida, el servidor no cobra un total distinto:
responde `TOTAL_MISMATCH` y la caja recarga el catálogo.

## Pendiente o fuera de alcance

- **Venta sin conexión:** el backend todavía no la tiene (decidido en `docs/PLAN-POS.md`).
- **Ticket:** se imprime desde el navegador en una ventana aparte, en 80 mm. No hay impresión directa a impresora térmica
  ni apertura automática de gaveta.
- **Exportar** reportes (Excel o PDF): el backend no tiene ese endpoint para el POS.
- **Cajeros y PIN:** los usuarios cajeros se crean en el sistema financiero; este frontend no administra usuarios.
- La lista de «sobrantes y faltantes» muestra todas las cuentas de gasto e ingreso que el backend acepta. Conviene elegir
  una cuenta propia de gasto, no la de ventas.
