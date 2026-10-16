// Formateo para la interfaz, con moneda y fechas dominicanas. Solo presentación: los montos los calcula el backend.
const TIME_ZONE = 'America/Santo_Domingo';

const moneyFormatter = new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' });
const amountFormatter = new Intl.NumberFormat('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const numberFormatter = new Intl.NumberFormat('es-DO', { maximumFractionDigits: 4 });
const dateFormatter = new Intl.DateTimeFormat('es-DO', { timeZone: TIME_ZONE, day: '2-digit', month: '2-digit', year: 'numeric' });
const dateTimeFormatter = new Intl.DateTimeFormat('es-DO', {
  timeZone: TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const timeFormatter = new Intl.DateTimeFormat('es-DO', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit' });
const inputDateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE });

type Amount = string | number | null | undefined;

const toNumber = (value: Amount): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/** RD$1,180.00 */
export function formatMoney(value: Amount): string {
  const n = toNumber(value);
  return n === null ? '—' : moneyFormatter.format(n);
}

/** 1,180.00 (sin símbolo: para columnas y cifras con el «RD$» aparte) */
export function formatAmount(value: Amount): string {
  const n = toNumber(value);
  return n === null ? '—' : amountFormatter.format(n);
}

export function formatNumber(value: Amount): string {
  const n = toNumber(value);
  return n === null ? '—' : numberFormatter.format(n);
}

function parse(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** dd/mm/aaaa en Santo Domingo */
export function formatDate(iso: string | null | undefined): string {
  const d = parse(iso);
  return d ? dateFormatter.format(d) : '—';
}

/** Un día sin hora («2026-10-16», como lo agrupa el reporte) en dd/mm/aaaa, sin correrlo de zona. */
export function formatDay(day: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : day;
}

export function formatDateTime(iso: string | null | undefined): string {
  const d = parse(iso);
  return d ? dateTimeFormatter.format(d) : '—';
}

export function formatTime(iso: string | null | undefined): string {
  const d = parse(iso);
  return d ? timeFormatter.format(d) : '—';
}

/** Fecha de hoy en Santo Domingo, como la usa un input type=date (AAAA-MM-DD). */
export function todayInput(now: Date = new Date()): string {
  return inputDateFormatter.format(now);
}

/** Primer día del mes de hoy en Santo Domingo (AAAA-MM-DD). */
export function monthStartInput(now: Date = new Date()): string {
  return `${todayInput(now).slice(0, 8)}01`;
}

/** Instante guardado en UTC → día en Santo Domingo (AAAA-MM-DD), para llenar un input type=date. */
export function isoToDateInput(iso: string): string {
  const d = parse(iso);
  return d ? inputDateFormatter.format(d) : '';
}

/** Inicio (00:00) o fin (23:59:59.999) de un día de Santo Domingo (UTC−4, sin horario de verano), en ISO. */
export function dayBoundaryIso(day: string, end = false): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const d = new Date(`${day}T${end ? '23:59:59.999' : '00:00:00.000'}-04:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
