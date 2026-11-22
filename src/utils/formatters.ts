import * as XLSX from 'xlsx';
import type { Resident } from '../types';

let lastIdCounter = 0;

/**
 * Generates a strictly increasing numeric ID safe for Android Long / JS number
 * and avoids collisions when multiple records are created in the same millisecond.
 */
export function generateNumericId(): number {
  const now = Date.now();
  if (now <= lastIdCounter) {
    lastIdCounter += 1;
  } else {
    lastIdCounter = now;
  }
  return lastIdCounter;
}

export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function formatDateTime(millis: number | null | undefined): string {
  if (!millis) return '—';
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(millis));
}

export function formatTimeOnly(millis: number | null | undefined): string {
  if (!millis) return '—';
  return new Intl.DateTimeFormat('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(millis));
}

export function formatDateOnly(millis: number | null | undefined): string {
  if (!millis) return '—';
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(millis));
}

export const SPANISH_MONTHS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

export function isTimestampInMonthYear(
  millis: number | null | undefined,
  monthIndex: number, // 0..11
  year: number
): boolean {
  if (!millis) return false;
  const d = new Date(millis);
  return d.getFullYear() === year && d.getMonth() === monthIndex;
}

export interface ParsedImportResident {
  fullName: string;
  building: string;
  apartment: string;
  accessCode: string;
  phone: string;
  vehiclePlates: string;
  isMoroso: boolean;
  blockOrSection: string;
  email: string;
  notes: string;
}

function findColumnValue(row: Record<string, unknown>, candidates: string[]): string {
  const keys = Object.keys(row);
  for (const key of keys) {
    const normKey = normalizeText(key).replace(/[^a-z0-9]/g, '');
    for (const candidate of candidates) {
      if (normKey === candidate || normKey.includes(candidate)) {
        const val = row[key];
        return val !== undefined && val !== null ? String(val).trim() : '';
      }
    }
  }
  return '';
}

function parsePaymentStatusIsMoroso(rawStatus: string): boolean {
  const norm = normalizeText(rawStatus);
  if (!norm) return false;
  // "Estatus pago (Sí/No o Moroso)"
  // If explicitly says "no", "moroso", "adeudo", "pendiente", "false", "0", "vencido" -> isMoroso = true
  if (
    norm === 'no' ||
    norm === 'n' ||
    norm.includes('moroso') ||
    norm.includes('adeudo') ||
    norm.includes('sin pago') ||
    norm.includes('impago') ||
    norm.includes('pendiente') ||
    norm === 'false' ||
    norm === '0'
  ) {
    return true;
  }
  // If says "si", "al corriente", "pagado", "activo", "true", "1" -> isMoroso = false
  if (
    norm === 'si' ||
    norm === 's' ||
    norm.includes('corriente') ||
    norm.includes('pagado') ||
    norm.includes('autorizado') ||
    norm === 'true' ||
    norm === '1'
  ) {
    return false;
  }
  return false;
}

export async function parseResidentsSpreadsheet(
  file: File
): Promise<ParsedImportResident[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('El archivo no contiene hojas de datos.');
  }
  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
  });

  if (rows.length === 0) {
    throw new Error('El archivo está vacío o no tiene filas con encabezados.');
  }

  const parsed: ParsedImportResident[] = [];

  for (const row of rows) {
    const fullName = findColumnValue(row, [
      'nombrecompleto',
      'nombre',
      'residente',
      'fullname',
      'name',
    ]);
    const building = findColumnValue(row, [
      'edificio',
      'torre',
      'building',
      'bloque',
    ]);
    const apartment = findColumnValue(row, [
      'departamento',
      'depto',
      'casa',
      'interior',
      'apartment',
      'housenumber',
    ]);
    const accessCode = findColumnValue(row, [
      'clavedeacceso',
      'clave',
      'codigo',
      'accesscode',
      'pin',
    ]);
    const phone = findColumnValue(row, [
      'telefono',
      'celular',
      'tel',
      'phone',
    ]);
    const vehiclePlates = findColumnValue(row, [
      'placas',
      'placa',
      'vehiculo',
      'vehicleplates',
    ]);
    const rawPayment = findColumnValue(row, [
      'estatuspago',
      'estatus',
      'pago',
      'moroso',
      'ismoroso',
      'status',
    ]);
    const blockOrSection = findColumnValue(row, [
      'seccion',
      'block',
      'section',
      'privada',
    ]);
    const email = findColumnValue(row, ['correo', 'email', 'mail']);
    const notes = findColumnValue(row, ['notas', 'observaciones', 'notes']);

    if (!fullName && !apartment && !accessCode) {
      continue;
    }

    parsed.push({
      fullName: fullName || 'Residente sin nombre',
      building: building || 'Principal',
      apartment: apartment || 'S/N',
      accessCode: accessCode || '',
      phone,
      vehiclePlates: vehiclePlates.toUpperCase(),
      isMoroso: parsePaymentStatusIsMoroso(rawPayment),
      blockOrSection,
      email,
      notes,
    });
  }

  if (parsed.length === 0) {
    throw new Error(
      'No se encontraron filas válidas. Verifica las columnas: Nombre completo, Edificio, Departamento, Clave de acceso, Teléfono, Placas, Estatus pago.'
    );
  }

  return parsed;
}

export function downloadResidentsTemplateCsv(): void {
  const headers = [
    'Nombre completo',
    'Edificio',
    'Departamento',
    'Clave de acceso',
    'Teléfono',
    'Placas',
    'Estatus pago',
  ];
  const sampleRows = [
    ['Juan Pérez García', 'Torre A', '101', '4821', '5512345678', 'ABC-123-A', 'Sí'],
    ['María López Hernández', 'Torre B', '304', '9105', '5587654321', 'XYZ-987-B', 'Moroso'],
  ];
  const csvContent =
    '\uFEFF' +
    [headers, ...sampleRows]
      .map((line) => line.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
      .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'plantilla_residentes_gavilan181.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function formatResidentLocation(resident: Pick<Resident, 'building' | 'apartment' | 'houseNumber'>): string {
  if (resident.building && resident.apartment) {
    return `${resident.building} · Depto. ${resident.apartment}`;
  }
  return resident.houseNumber || resident.apartment || resident.building || 'Sin ubicación';
}
