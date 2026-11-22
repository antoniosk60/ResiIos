import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArchiveRestore,
  FileText,
  History,
  Trash2,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import {
  assignCapturistaSlot,
  executeMonthlyClosePurge,
  removeCapturistaSlot,
} from '../services/firestoreService';
import {
  exportAuditLogsPdf,
  exportMonthlyClosePdf,
  exportResidentsPdf,
  exportTardinessPdf,
  exportVisitsPdf,
} from '../services/pdfService';
import type {
  AuditLog,
  AuthorizedUser,
  CapturistaSlot,
  Resident,
  Tardiness,
  Visit,
} from '../types';
import {
  formatDateTime,
  isTimestampInMonthYear,
  SPANISH_MONTHS,
} from '../utils/formatters';

interface AdminPanelViewProps {
  actor: AuthorizedUser;
  capturistaSlots: CapturistaSlot[];
  residents: Resident[];
  visits: Visit[];
  tardiness: Tardiness[];
  auditLogs: AuditLog[];
}

export const AdminPanelView: React.FC<AdminPanelViewProps> = ({
  actor,
  capturistaSlots,
  residents,
  visits,
  tardiness,
  auditLogs,
}) => {
  // Capturista Slot management
  const [slotModalId, setSlotModalId] = useState<string | null>(null);
  const [slotEmail, setSlotEmail] = useState('');
  const [slotError, setSlotError] = useState<string | null>(null);
  const [savingSlot, setSavingSlot] = useState(false);

  // Monthly Close state
  const nowDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(nowDate.getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(nowDate.getFullYear());
  const [closeStep, setCloseStep] = useState<0 | 1 | 2>(0); // 0=closed, 1=first confirm, 2=double confirm
  const [confirmText, setConfirmText] = useState('');
  const [purging, setPurging] = useState(false);
  const [closeFeedback, setCloseFeedback] = useState<string | null>(null);

  const slotMap = useMemo(() => {
    const map = new Map<string, CapturistaSlot>();
    capturistaSlots.forEach((s) => map.set(s.slotId, s));
    return map;
  }, [capturistaSlots]);

  const availableYears = useMemo(() => {
    const current = new Date().getFullYear();
    return [current - 1, current, current + 1];
  }, []);

  const monthlyStats = useMemo(() => {
    const mVisits = visits.filter((v) =>
      isTimestampInMonthYear(v.entryTimestampMillis, selectedMonth, selectedYear)
    );
    const mTardiness = tardiness.filter((t) =>
      isTimestampInMonthYear(t.timestampMillis, selectedMonth, selectedYear)
    );
    const mLogs = auditLogs.filter((l) =>
      isTimestampInMonthYear(l.timestampMillis, selectedMonth, selectedYear)
    );
    return { mVisits, mTardiness, mLogs };
  }, [visits, tardiness, auditLogs, selectedMonth, selectedYear]);

  const monthLabel = `${SPANISH_MONTHS[selectedMonth]} ${selectedYear}`;

  const handleAssignSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slotModalId) return;
    setSavingSlot(true);
    setSlotError(null);
    try {
      await assignCapturistaSlot(slotModalId, slotEmail, actor);
      setSlotModalId(null);
      setSlotEmail('');
    } catch (err) {
      setSlotError(
        err instanceof Error ? err.message : 'No se pudo asignar el capturista.'
      );
    } finally {
      setSavingSlot(false);
    }
  };

  const handleRemoveSlot = async (slot: CapturistaSlot) => {
    await removeCapturistaSlot(slot.slotId, slot.email, actor);
  };

  const handleStartMonthlyClose = () => {
    setCloseFeedback(null);
    // Step 1: Always generate & download consolidated PDF first
    exportMonthlyClosePdf({
      monthLabel,
      visits: monthlyStats.mVisits,
      tardiness: monthlyStats.mTardiness,
      auditLogs: monthlyStats.mLogs,
    });
    setConfirmText('');
    setCloseStep(1);
  };

  const handleExecutePurge = async () => {
    if (confirmText.trim().toUpperCase() !== 'CONFIRMAR') return;
    setPurging(true);
    try {
      const result = await executeMonthlyClosePurge({
        monthIndex: selectedMonth,
        year: selectedYear,
        visits,
        tardiness,
        auditLogs,
        actor,
      });
      setCloseStep(0);
      setConfirmText('');
      setCloseFeedback(
        `Cierre de ${monthLabel} completado: se descargó el PDF y se eliminaron ${result.deletedVisits} visitas, ${result.deletedTardiness} retardos y ${result.deletedLogs} registros de auditoría. El catálogo de residentes permanece intacto.`
      );
    } finally {
      setPurging(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Capturista Slots (1..5) */}
      <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Cupos de Capturistas (Máximo 5)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Autoriza cuentas de Google para el personal de caseta en slots 1 al 5.
            </p>
          </div>
          <span className="font-mono text-xs font-bold text-slate-700 tabular-nums">
            {capturistaSlots.length} / 5
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {['1', '2', '3', '4', '5'].map((slotId) => {
            const assigned = slotMap.get(slotId);
            return (
              <div
                key={slotId}
                className={`rounded-xl border p-3.5 flex flex-col justify-between gap-3 ${
                  assigned
                    ? 'bg-slate-50 border-slate-200'
                    : 'bg-white border-dashed border-slate-300'
                }`}
              >
                <div>
                  <p className="font-mono text-xs font-bold text-slate-500">
                    SLOT {slotId}
                  </p>
                  {assigned ? (
                    <p className="mt-1 text-xs font-semibold text-slate-900 break-all">
                      {assigned.email}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-slate-400">Disponible</p>
                  )}
                </div>

                {assigned ? (
                  <button
                    type="button"
                    onClick={() => handleRemoveSlot(assigned)}
                    className="min-h-[40px] w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Quitar
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setSlotModalId(slotId);
                      setSlotEmail('');
                      setSlotError(null);
                    }}
                    className="min-h-[40px] w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Asignar
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 2. Exportación de Reportes PDF & Cierre Mensual */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Exportar Reportes PDF */}
        <section className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Exportar Reportes PDF
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 mb-4">
              Descarga inmediata en formato PDF listo para impresión o envío.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => exportTardinessPdf(tardiness)}
              className="min-h-[48px] inline-flex items-center justify-start gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50 text-left"
            >
              <FileText className="w-4 h-4 text-slate-600 shrink-0" />
              <span>Reporte de Retardos ({tardiness.length})</span>
            </button>

            <button
              type="button"
              onClick={() => exportResidentsPdf(residents)}
              className="min-h-[48px] inline-flex items-center justify-start gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50 text-left"
            >
              <FileText className="w-4 h-4 text-slate-600 shrink-0" />
              <span>Catálogo Residentes ({residents.length})</span>
            </button>

            <button
              type="button"
              onClick={() => exportVisitsPdf(visits)}
              className="min-h-[48px] inline-flex items-center justify-start gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50 text-left"
            >
              <FileText className="w-4 h-4 text-slate-600 shrink-0" />
              <span>Reporte de Visitas ({visits.length})</span>
            </button>

            <button
              type="button"
              onClick={() => exportAuditLogsPdf(auditLogs)}
              className="min-h-[48px] inline-flex items-center justify-start gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50 text-left"
            >
              <FileText className="w-4 h-4 text-slate-600 shrink-0" />
              <span>Bitácora Auditoría ({auditLogs.length})</span>
            </button>
          </div>
        </section>

        {/* Cierre Mensual */}
        <section className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
              <ArchiveRestore className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Cierre Mensual</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Genera el PDF consolidado del mes seleccionado y depura sus registros de visitas, retardos y auditoría (el catálogo de residentes se conserva intacto).
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mes
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-900"
              >
                {SPANISH_MONTHS.map((m, idx) => (
                  <option key={m} value={idx}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Año
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-900 tabular-nums"
              >
                {availableYears.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-3 rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-700 flex flex-wrap items-center gap-x-3 gap-y-1 tabular-nums">
            <span className="font-semibold text-slate-900">{monthLabel}:</span>
            <span>{monthlyStats.mVisits.length} visitas</span>
            <span aria-hidden="true">·</span>
            <span>{monthlyStats.mTardiness.length} retardos</span>
            <span aria-hidden="true">·</span>
            <span>{monthlyStats.mLogs.length} eventos auditoría</span>
          </div>

          {closeFeedback && (
            <div className="mt-3 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 font-medium">
              {closeFeedback}
            </div>
          )}

          <button
            type="button"
            onClick={handleStartMonthlyClose}
            className="mt-4 w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
          >
            <ArchiveRestore className="w-4 h-4" />
            Ejecutar Cierre Mensual ({monthLabel})
          </button>
        </section>
      </div>

      {/* 3. Bitácora de Auditoría */}
      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-4 sm:px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-600" />
            <h2 className="text-base font-bold text-slate-900">
              Bitácora de Auditoría (Solo lectura)
            </h2>
          </div>
          <span className="font-mono text-xs text-slate-500 tabular-nums">
            {auditLogs.length} eventos
          </span>
        </div>

        {auditLogs.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Sin eventos registrados en auditoría.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
            {auditLogs.slice(0, 100).map((log) => (
              <li key={log.id} className="px-4 sm:px-5 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">
                    {log.title}
                  </p>
                  <span className="font-mono text-xs text-slate-500 tabular-nums">
                    {formatDateTime(log.timestampMillis)}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">{log.details}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {log.userName} · {log.userRole} · {log.actionType}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Modal: Asignar Slot Capturista */}
      {slotModalId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4"
          onClick={() => setSlotModalId(null)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-slate-900">
                Asignar Capturista (Slot {slotModalId})
              </h3>
              <button
                type="button"
                onClick={() => setSlotModalId(null)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAssignSlot} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Correo de Google autorizado *
                </label>
                <input
                  type="email"
                  required
                  value={slotEmail}
                  onChange={(e) => setSlotEmail(e.target.value)}
                  placeholder="guardia.caseta@gmail.com"
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 text-sm focus:border-slate-900 focus:outline-none"
                />
              </div>
              {slotError && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700">
                  {slotError}
                </div>
              )}
              <button
                type="submit"
                disabled={savingSlot}
                className="w-full min-h-[48px] rounded-xl bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {savingSlot ? 'Autorizando...' : 'Autorizar Capturista'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Cierre Mensual Doble Confirmación */}
      {closeStep > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4"
          onClick={() => setCloseStep(0)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            {closeStep === 1 ? (
              <>
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
                  <UserCheck className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">
                  Paso 1 de 2: PDF Consolidado Descargado
                </h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  Se generó el archivo PDF de cierre para{' '}
                  <strong className="text-slate-900">{monthLabel}</strong> con{' '}
                  {monthlyStats.mVisits.length} visitas, {monthlyStats.mTardiness.length}{' '}
                  retardos y {monthlyStats.mLogs.length} eventos de auditoría.
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  ¿Deseas continuar al paso final para eliminar permanentemente esos registros de Firestore? El catálogo de residentes NO será modificado.
                </p>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setCloseStep(0)}
                    className="min-h-[48px] rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => setCloseStep(2)}
                    className="min-h-[48px] rounded-xl bg-amber-600 text-sm font-semibold text-white hover:bg-amber-700"
                  >
                    Continuar a depuración
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mb-4">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">
                  Paso 2 de 2: Confirmación Definitiva
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  Esta acción eliminará permanentemente de Firestore los registros de{' '}
                  <strong className="text-slate-900">{monthLabel}</strong> (visitas, retardos y auditoría).
                </p>
                <div className="mt-4">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Escribe <span className="font-mono text-red-600">CONFIRMAR</span> para habilitar la eliminación:
                  </label>
                  <input
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="CONFIRMAR"
                    className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 font-mono text-sm uppercase focus:border-red-600 focus:outline-none"
                  />
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setCloseStep(0)}
                    className="min-h-[48px] rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleExecutePurge}
                    disabled={purging || confirmText.trim().toUpperCase() !== 'CONFIRMAR'}
                    className="min-h-[48px] rounded-xl bg-red-600 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40"
                  >
                    {purging ? 'Eliminando...' : 'Eliminar Mes'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
