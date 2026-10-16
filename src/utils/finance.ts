// Enlaces al sistema financiero (Angular), donde vive la contabilidad. El POS no la duplica: cada venta, compra, cobro
// y ajuste ya queda allí como documento con su asiento.
export const FINANCE_URL = (import.meta.env.VITE_FINANCE_URL || 'http://localhost:4200').replace(/\/+$/, '');

export interface FinanceLink {
  label: string;
  path: string;
  hint: string;
}

export interface FinanceGroup {
  title: string;
  links: FinanceLink[];
}

export const FINANCE_GROUPS: FinanceGroup[] = [
  {
    title: 'Resumen',
    links: [
      { label: 'Panel', path: '/', hint: 'Cifras del negocio y lo que requiere atención.' },
      { label: 'Estados financieros', path: '/reports', hint: 'Balance general, estado de resultados y flujo de efectivo.' },
      { label: 'Semáforo financiero', path: '/analysis', hint: 'Indicadores de liquidez, rentabilidad y endeudamiento.' },
    ],
  },
  {
    title: 'Contabilidad',
    links: [
      { label: 'Asientos', path: '/entries', hint: 'Cada venta, compra, cobro y ajuste del POS tiene su asiento aquí.' },
      { label: 'Plan de cuentas', path: '/accounts', hint: 'Catálogo de cuentas de la empresa.' },
      { label: 'Cierre de mes guiado', path: '/period-close', hint: 'Revisar y cerrar el mes.' },
      { label: 'Cuentas automáticas', path: '/accounting-settings', hint: 'Cuentas de inventario, costo, ventas e ITBIS que usa el POS.' },
    ],
  },
  {
    title: 'Impuestos y DGII',
    links: [
      { label: 'Formatos 606 · 607 · 608', path: '/dgii', hint: 'Las ventas y compras del POS entran solas.' },
      { label: 'Declaraciones (IT-1, IR-17)', path: '/dgii/it1', hint: 'Hojas de las declaraciones del mes.' },
      { label: 'Comprobantes fiscales (NCF)', path: '/ncf', hint: 'Secuencias B01, B02, B04 y e-CF.' },
      { label: 'Calendario fiscal', path: '/fiscal-calendar', hint: 'Fechas de presentación y pago.' },
    ],
  },
  {
    title: 'Dinero',
    links: [
      { label: 'Bancos y cajas', path: '/bank-accounts', hint: 'Cajas de efectivo y cuentas bancarias del POS.' },
      { label: 'Conciliación bancaria', path: '/reconciliations', hint: 'Cuadrar los bancos con el estado de cuenta.' },
      { label: 'Lo que me deben y lo que debo', path: '/receivables', hint: 'Antigüedad de saldos de clientes y proveedores.' },
      { label: 'Cobros y pagos', path: '/payments', hint: 'Pagos a proveedores y cobros registrados.' },
    ],
  },
];

export const financeUrl = (path: string) => `${FINANCE_URL}${path.startsWith('/') ? path : `/${path}`}`;
