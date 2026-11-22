import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  DoorOpen,
  LogOut as ExitIcon,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { createVisit, markVisitExit } from '../services/firestoreService';
import type { AuthorizedUser, Resident, Visit, VisitAccessStatus } from '../types';
import {
  formatDateTime,
  formatResidentLocation,
  normalizeText,
} from '../utils/formatters';

interface VisitsViewProps {
  visits: Visit[];
  residents: Resident[];
  actor: AuthorizedUser;
  preselectedResident: Resident | null;
  onClearPreselectedResident: () => void;
  openComposerSignal: number;
}

type VisitFilter = 'ACTIVAS' | 'TODAS' | 'PERMITIDO' | 'MOROSO';

const VISIT_REASONS = [
  'Visita familiar',
  'Paquetería / Delivery',
  'Servicio / Mantenimiento',
  'Proveedor',
  'Taxi / App',
];

export const VisitsView: React.FC<VisitsViewProps> = ({
  visits,
  residents,
  actor,
  preselectedResident,
  onClearPreselectedResident,
  openComposerSignal,
}) => {
  const [filter, setFilter] = useState<VisitFilter>('ACTIVAS');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exitingId, setExitingId] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Composer state
  const [residentSearch, setResidentSearch] = useState('');
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null);
  const [visitorName, setVisitorName] = useState('');
  const [visitorIdOrIne, setVisitorIdOrIne] = useState('');
  const [visitorVehiclePlates, setVisitorVehiclePlates] = useState('');
  const [reason, setReason] = useState('Visita familiar');
  const [accessStatus, setAccessStatus] = useState<VisitAccessStatus>('PERMITIDO');
  const [accessCodeUsed, setAccessCodeUsed] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (openComposerSignal > 0) {
      if (preselectedResident) {
        setSelectedResident(preselectedResident);
        setResidentSearch(
          `${preselectedResident.fullName} (${preselectedResident.building} ${preselectedResident.apartment})`
        );
        setAccessStatus(
          preselectedResident.isMoroso ? 'SIN_CLAVE_MOROSO' : 'PERMITIDO'
        );
        setAccessCodeUsed(
          preselectedResident.isMoroso ? '' : preselectedResident.accessCode
        );
      } else {
        setSelectedResident(null);
        setResidentSearch('');
        setAccessStatus('PERMITIDO');
        setAccessCodeUsed('');
      }
      setVisitorName('');
      setVisitorIdOrIne('');
      setVisitorVehiclePlates('');
      setReason('Visita familiar');
      setNotes('');
      setFormError(null);
      setShowModal(true);
    }
  }, [openComposerSignal, preselectedResident]);

  const activeCount = useMemo(
    () => visits.filter((v) => !v.exitTimestampMillis).length,
    [visits]
  );

  const filteredVisits = useMemo(() => {
    const q = normalizeText(search);
    return visits.filter((v) => {
      if (filter === 'ACTIVAS' && v.exitTimestampMillis !== null) return false;
      if (filter === 'PERMITIDO' && v.accessStatus !== 'PERMITIDO') return false;
      if (filter === 'MOROSO' && v.accessStatus !== 'SIN_CLAVE_MOROSO') return false;
      if (!q) return true;
      return [
        v.visitorName,
        v.visitorVehiclePlates,
        v.residentName,
        v.building,
        v.apartment,
        v.reason,
      ].some((f) => normalizeText(f || '').includes(q));
    });
  }, [visits, filter, search]);

  const matchingResidents = useMemo(() => {
    const q = normalizeText(residentSearch);
    if (!q) return residents.slice(0, 10);
    return residents
      .filter((r) =>
        [r.fullName, r.building, r.apartment, r.accessCode, r.houseNumber].some(
          (f) => normalizeText(f || '').includes(q)
        )
      )
      .slice(0, 10);
  }, [residents, residentSearch]);

  const handleOpenNew = () => {
    onClearPreselectedResident();
    setSelectedResident(null);
    setResidentSearch('');
    setVisitorName('');
    setVisitorIdOrIne('');
    setVisitorVehiclePlates('');
    setReason('Visita familiar');
    setAccessStatus('PERMITIDO');
    setAccessCodeUsed('');
    setNotes('');
    setFormError(null);
    setShowModal(true);
  };

  const handleSelectResident = (resident: Resident) => {
    setSelectedResident(resident);
    setResidentSearch(
      `${resident.fullName} (${resident.building} ${resident.apartment})`
    );
    setAccessStatus(resident.isMoroso ? 'SIN_CLAVE_MOROSO' : 'PERMITIDO');
    setAccessCodeUsed(resident.isMoroso ? '' : resident.accessCode);
  };

  const handleCreateVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedResident) {
      setFormError('Selecciona el residente o departamento destino.');
      return;
    }
    if (!visitorName.trim()) {
      setFormError('Ingresa el nombre completo del visitante.');
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      await createVisit(
        {
          visitorName,
          visitorIdOrIne,
          visitorVehiclePlates,
          building: selectedResident.building,
          apartment: selectedResident.apartment,
          residentId: selectedResident.id,
          residentName: selectedResident.fullName,
          reason,
          isResidentMoroso: selectedResident.isMoroso,
          accessStatus,
          accessCodeUsed,
          notes,
        },
        actor
      );
      setShowModal(false);
      onClearPreselectedResident();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'No se pudo registrar la visita.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleMarkExit = async (visit: Visit) => {
    setExitingId(visit.id);
    try {
      await markVisitExit(visit, actor);
    } finally {
      setExitingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header & Action */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Control de Visitas</h2>
          <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
            {activeCount} activas dentro · {visits.length} registros totales
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenNew}
          className="min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 active:scale-[0.98] transition-all whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          Registrar Visita
        </button>
      </div>

      {/* Filters & Search */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-sm">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar visitante, placas, residente o depto..."
            className="w-full min-h-[44px] pl-10 pr-4 rounded-xl border border-slate-300 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-slate-900 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {(
            [
              ['ACTIVAS', `Dentro (${activeCount})`],
              ['TODAS', 'Todas'],
              ['PERMITIDO', 'Permitidas'],
              ['MOROSO', 'Sin clave / Moroso'],
            ] as [VisitFilter, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`min-h-[40px] px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                filter === key
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Visits List */}
      {filteredVisits.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
          <DoorOpen className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-800">
            No hay visitas en esta vista
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Toca "Registrar Visita" para capturar una nueva entrada.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredVisits.map((visit) => {
            const isInside = visit.exitTimestampMillis === null;
            const isMorosoStatus = visit.accessStatus === 'SIN_CLAVE_MOROSO';
            return (
              <article
                key={visit.id}
                className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between gap-3"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-slate-900 truncate">
                        {visit.visitorName}
                      </h3>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {visit.building} · Depto. {visit.apartment} — {visit.residentName}
                      </p>
                    </div>
                    <div
                      className={`inline-flex items-center gap-1 text-xs font-bold shrink-0 ${
                        isMorosoStatus ? 'text-red-600' : 'text-emerald-600'
                      }`}
                    >
                      {isMorosoStatus ? (
                        <AlertTriangle className="w-4 h-4" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      <span>{isMorosoStatus ? 'Sin clave / Moroso' : 'Permitido'}</span>
                    </div>
                  </div>

                  <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span>{visit.reason}</span>
                    {visit.visitorVehiclePlates && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono font-semibold text-slate-700">
                          Placas: {visit.visitorVehiclePlates}
                        </span>
                      </>
                    )}
                    {visit.visitorIdOrIne && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>ID: {visit.visitorIdOrIne}</span>
                      </>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-100 text-xs text-slate-600 space-y-0.5 tabular-nums">
                    <p>
                      <span className="font-semibold text-slate-800">Entrada:</span>{' '}
                      {formatDateTime(visit.entryTimestampMillis)}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-800">Salida:</span>{' '}
                      {visit.exitTimestampMillis
                        ? formatDateTime(visit.exitTimestampMillis)
                        : 'En curso (dentro del residencial)'}
                    </p>
                    {visit.notes && (
                      <p className="text-slate-500 pt-1">Nota: {visit.notes}</p>
                    )}
                  </div>
                </div>

                {isInside && (
                  <button
                    type="button"
                    onClick={() => handleMarkExit(visit)}
                    disabled={exitingId === visit.id}
                    className="min-h-[44px] w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-100 active:scale-[0.98] disabled:opacity-60 transition-all"
                  >
                    <ExitIcon className="w-4 h-4" />
                    {exitingId === visit.id ? 'Registrando salida...' : 'Registrar Salida'}
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* Modal / Bottom Sheet: Nueva Visita */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-sm sm:p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white p-5 pb-safe shadow-xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto mb-3 sm:hidden" />

            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="text-lg font-bold text-slate-900">
                Registrar Nueva Visita
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateVisit} className="space-y-4">
              {/* Resident Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Residente / Unidad destino *
                </label>
                <input
                  type="text"
                  value={residentSearch}
                  onChange={(e) => {
                    setResidentSearch(e.target.value);
                    if (selectedResident) setSelectedResident(null);
                  }}
                  placeholder="Buscar por nombre, depto o clave..."
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 text-sm focus:border-slate-900 focus:outline-none"
                />

                {!selectedResident && (
                  <div className="mt-1.5 max-h-40 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-slate-50">
                    {matchingResidents.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => handleSelectResident(r)}
                        className="w-full min-h-[44px] px-3 py-2 text-left text-xs flex items-center justify-between hover:bg-white"
                      >
                        <span className="font-semibold text-slate-900 truncate">
                          {r.fullName} · {formatResidentLocation(r)}
                        </span>
                        <span
                          className={`font-semibold shrink-0 ml-2 ${
                            r.isMoroso ? 'text-red-600' : 'text-emerald-600'
                          }`}
                        >
                          {r.isMoroso ? 'Moroso' : 'Al corriente'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {selectedResident && (
                  <div
                    className={`mt-2 rounded-xl p-3 border text-xs flex items-center justify-between ${
                      selectedResident.isMoroso
                        ? 'bg-red-50 border-red-200 text-red-800'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    }`}
                  >
                    <div>
                      <p className="font-bold">{selectedResident.fullName}</p>
                      <p>
                        {formatResidentLocation(selectedResident)} ·{' '}
                        {selectedResident.isMoroso
                          ? 'RESIDENTE MOROSO'
                          : `Clave: ${selectedResident.accessCode || 'N/A'}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedResident(null);
                        setResidentSearch('');
                      }}
                      className="min-h-[36px] px-2.5 rounded-lg bg-white/80 text-slate-800 font-semibold"
                    >
                      Cambiar
                    </button>
                  </div>
                )}
              </div>

              {/* Visitor Info */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Nombre del visitante *
                </label>
                <input
                  type="text"
                  required
                  value={visitorName}
                  onChange={(e) => setVisitorName(e.target.value)}
                  placeholder="Ej. Carlos Mendoza"
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 text-sm focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Placas vehículo
                  </label>
                  <input
                    type="text"
                    value={visitorVehiclePlates}
                    onChange={(e) => setVisitorVehiclePlates(e.target.value.toUpperCase())}
                    placeholder="ABC-123"
                    className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 font-mono text-sm uppercase focus:border-slate-900 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    INE / Identificación
                  </label>
                  <input
                    type="text"
                    value={visitorIdOrIne}
                    onChange={(e) => setVisitorIdOrIne(e.target.value)}
                    placeholder="Folio o tipo ID"
                    className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 text-sm focus:border-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              {/* Reason presets */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Motivo de la visita
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {VISIT_REASONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setReason(r)}
                      className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        reason === r
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 text-sm focus:border-slate-900 focus:outline-none"
                />
              </div>

              {/* Access status & code */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Estatus de acceso
                  </label>
                  <select
                    value={accessStatus}
                    onChange={(e) =>
                      setAccessStatus(e.target.value as VisitAccessStatus)
                    }
                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 text-sm bg-white focus:border-slate-900 focus:outline-none"
                  >
                    <option value="PERMITIDO">PERMITIDO</option>
                    <option value="SIN_CLAVE_MOROSO">SIN_CLAVE_MOROSO</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Clave usada
                  </label>
                  <input
                    type="text"
                    value={accessCodeUsed}
                    onChange={(e) => setAccessCodeUsed(e.target.value)}
                    placeholder="Opcional"
                    className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 font-mono text-sm focus:border-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Observaciones
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notas adicionales de caseta..."
                  className="w-full p-3 rounded-xl border border-slate-300 text-sm focus:border-slate-900 focus:outline-none"
                />
              </div>

              {formError && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700 font-medium">
                  {formError}
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full min-h-[48px] rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 transition-all"
              >
                {saving ? 'Guardando entrada...' : 'Guardar Entrada de Visita'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
