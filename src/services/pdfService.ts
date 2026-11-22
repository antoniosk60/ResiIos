import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { AuditLog, Resident, Tardiness, Visit } from '../types';
import { formatDateTime } from '../utils/formatters';

function createBrandedDoc(title: string, subtitle: string): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 216, 26, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('GAVILÁN 181 — SEGURIDAD PRIVADA YAOTECATL', 14, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(title, 14, 18);

  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  doc.text(`Generado: ${formatDateTime(Date.now())}`, 14, 23);

  doc.setTextColor(51, 65, 85);
  doc.setFontSize(9.5);
  doc.text(subtitle, 14, 33);

  return doc;
}

export function exportResidentsPdf(residents: Resident[]): void {
  const doc = createBrandedDoc(
    'Catálogo General de Residentes',
    `Total de unidades registradas: ${residents.length}`
  );

  autoTable(doc, {
    startY: 38,
    head: [['Nombre', 'Edif / Depto', 'Clave', 'Placas', 'Teléfono', 'Estatus']],
    body: residents.map((r) => [
      r.fullName,
      `${r.building} ${r.apartment}`,
      r.accessCode || '—',
      r.vehiclePlates || '—',
      r.phone || '—',
      r.isMoroso ? 'MOROSO' : r.isActive ? 'AL CORRIENTE' : 'INACTIVO',
    ]),
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  doc.save(`residentes_gavilan181_${Date.now()}.pdf`);
}

export function exportVisitsPdf(visits: Visit[]): void {
  const doc = createBrandedDoc(
    'Reporte de Control de Visitas',
    `Total de visitas listadas: ${visits.length}`
  );

  autoTable(doc, {
    startY: 38,
    head: [['Visitante', 'Destino / Residente', 'Motivo', 'Placas', 'Estatus', 'Entrada', 'Salida']],
    body: visits.map((v) => [
      v.visitorName,
      `${v.building} ${v.apartment}\n${v.residentName}`,
      v.reason,
      v.visitorVehiclePlates || '—',
      v.accessStatus === 'PERMITIDO' ? 'PERMITIDO' : 'SIN CLAVE / MOROSO',
      formatDateTime(v.entryTimestampMillis),
      v.exitTimestampMillis ? formatDateTime(v.exitTimestampMillis) : 'Dentro',
    ]),
    styles: { fontSize: 7.5, cellPadding: 2 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  doc.save(`visitas_gavilan181_${Date.now()}.pdf`);
}

export function exportTardinessPdf(records: Tardiness[]): void {
  const doc = createBrandedDoc(
    'Reporte de Retardos e Incidencias',
    `Total de registros de retardo: ${records.length}`
  );

  autoTable(doc, {
    startY: 38,
    head: [['Fecha / Hora', 'Residente', 'Unidad', 'Motivo', 'Placas', 'Registró']],
    body: records.map((t) => [
      formatDateTime(t.timestampMillis),
      t.residentName,
      t.houseNumber,
      t.reason,
      t.vehiclePlate || '—',
      t.registeredBy,
    ]),
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  doc.save(`retardos_gavilan181_${Date.now()}.pdf`);
}

export function exportAuditLogsPdf(logs: AuditLog[]): void {
  const doc = createBrandedDoc(
    'Bitácora Inmutable de Auditoría',
    `Total de eventos registrados: ${logs.length}`
  );

  autoTable(doc, {
    startY: 38,
    head: [['Fecha / Hora', 'Usuario', 'Rol', 'Acción', 'Detalle']],
    body: logs.map((l) => [
      formatDateTime(l.timestampMillis),
      l.userName,
      l.userRole,
      l.title,
      l.details,
    ]),
    styles: { fontSize: 7.5, cellPadding: 2 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  doc.save(`auditoria_gavilan181_${Date.now()}.pdf`);
}

export function exportMonthlyClosePdf(params: {
  monthLabel: string;
  visits: Visit[];
  tardiness: Tardiness[];
  auditLogs: AuditLog[];
}): void {
  const { monthLabel, visits, tardiness, auditLogs } = params;
  const doc = createBrandedDoc(
    `Cierre Mensual Consolidado — ${monthLabel}`,
    `Visitas: ${visits.length}  |  Retardos: ${tardiness.length}  |  Auditoría: ${auditLogs.length}`
  );

  // Section 1: Visits
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`1. Registro de Visitas (${visits.length})`, 14, 42);

  autoTable(doc, {
    startY: 45,
    head: [['Visitante', 'Destino', 'Residente', 'Estatus', 'Entrada', 'Salida']],
    body:
      visits.length > 0
        ? visits.map((v) => [
            v.visitorName,
            `${v.building} ${v.apartment}`,
            v.residentName,
            v.accessStatus === 'PERMITIDO' ? 'PERMITIDO' : 'SIN CLAVE / MOROSO',
            formatDateTime(v.entryTimestampMillis),
            v.exitTimestampMillis ? formatDateTime(v.exitTimestampMillis) : 'Sin salida',
          ])
        : [['Sin visitas registradas en este periodo', '—', '—', '—', '—', '—']],
    styles: { fontSize: 7.5, cellPadding: 2 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
  });

  const afterVisitsY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 60;

  // Section 2: Tardiness
  let nextY = afterVisitsY + 10;
  if (nextY > 240) {
    doc.addPage();
    nextY = 18;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`2. Registro de Retardos (${tardiness.length})`, 14, nextY);

  autoTable(doc, {
    startY: nextY + 3,
    head: [['Fecha / Hora', 'Residente', 'Unidad', 'Motivo', 'Placas', 'Registró']],
    body:
      tardiness.length > 0
        ? tardiness.map((t) => [
            formatDateTime(t.timestampMillis),
            t.residentName,
            t.houseNumber,
            t.reason,
            t.vehiclePlate || '—',
            t.registeredBy,
          ])
        : [['Sin retardos registrados en este periodo', '—', '—', '—', '—', '—']],
    styles: { fontSize: 7.5, cellPadding: 2 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
  });

  const afterTardY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 120;

  // Section 3: Audit Logs
  let auditY = afterTardY + 10;
  if (auditY > 240) {
    doc.addPage();
    auditY = 18;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`3. Bitácora de Auditoría (${auditLogs.length})`, 14, auditY);

  autoTable(doc, {
    startY: auditY + 3,
    head: [['Fecha / Hora', 'Usuario', 'Rol', 'Evento', 'Detalle']],
    body:
      auditLogs.length > 0
        ? auditLogs.map((l) => [
            formatDateTime(l.timestampMillis),
            l.userName,
            l.userRole,
            l.title,
            l.details,
          ])
        : [['Sin eventos de auditoría en este periodo', '—', '—', '—', '—']],
    styles: { fontSize: 7.5, cellPadding: 2 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
  });

  const safeSlug = monthLabel.toLowerCase().replace(/\s+/g, '_');
  doc.save(`cierre_mensual_${safeSlug}_gavilan181.pdf`);
}
