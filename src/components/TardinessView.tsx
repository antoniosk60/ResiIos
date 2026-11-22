import React, { useEffect, useMemo, useState } from 'react';
import { Clock, Plus, Search, Trash2, X } from 'lucide-react';
import { createTardiness, deleteTardiness } from '../services/firestoreService';
import type { AuthorizedUser, Resident, Tardiness } from '../types';
import {
  formatDateTime,
  formatResidentLocation,
  normalizeText,
} from '../utils/formatters';

interface TardinessViewProps {
  tardinessList: Tardiness[];
  residents: Resident[];
  actor: AuthorizedUser;
  preselectedResident: Resident | null;
  onClearPreselectedResident: () => void;
  openComposerSignal: number;
}

const TARDINESS_REASONS = [
  'Retardo horario nocturno',
  'Acceso sin tag / control',
  'Ingreso tardío de vehículo',
  'Estacionamiento indebido',
];

export const TardinessView: React.FC<TardinessViewProps> = ({
  tardinessList,
  residents,
  actor,
  preselectedResident,
  onClearPreselectedResident,
  openComposerSignal,
}) => {
  const isAdmin = actor.role === 'ADMINISTRADOR';
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [confirmDeleteRecord, setConfirmDeleteRecord] = useState<Tardiness | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);

  // Composer state
  const [residentSearch, setResidentSearch] = useState('');
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null);
  const [reason, setReason] = useState('Retardo horario nocturno');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (openComposerSignal > 0) {
      if (preselectedResident) {
        setSelectedResident(preselectedResident);
        setResidentSearch(
          `${preselectedResident.fullName} (${preselectedResident.building} ${preselectedResident.apartment})`
        );
        setVehiclePlate(preselectedResident.vehiclePlates || '');
      } else {
        setSelectedResident(null);
        setResidentSearch('');
        setVehiclePlate('');
      }
      setReason('Retardo horario nocturno');
      setNotes('');
      setFormError(null);
      setShowModal(true);
    }
  }, [openComposerSignal, preselectedResident]);

  const filteredRecords = useMemo(() => {
    const q = normalizeText(search);
    if (!q) return tardinessList;
    return tardinessList.filter((t) =>
      [t.residentName, t.houseNumber, t.reason, t.vehiclePlate, t.registeredBy].some(
        (f) => normalizeText(f || '').includes(q)
      )
    );
  }, [tardinessList, search]);

  const matchingResidents = useMemo(() => {
    const q = normalizeText(residentSearch);
    if (!q) return residents.slice(0, 10);
    return residents
      .filter((r) =>
        [r.fullName, r.building, r.apartment, r.accessCode, r.vehiclePlates].some(
          (f) => normalizeText(f || '').includes(q)
        )
      )
      .slice(0, 10);
  }, [residents, residentSearch]);

  const handleOpenNew = () => {
    onClearPreselectedResident();
    setSelectedResident(null);
    setResidentSearch('');
    setReason('Retardo horario nocturno');
    setVehiclePlate('');
    setNotes('');
    setFormError(null);
    setShowModal(true);
  };

  const handleSelectResident = (resident: Resident) => {
    setSelectedResident(resident);
    setResidentSearch(
      `${resident.fullName} (${resident.building} ${resident.apartment})`
    );
    setVehiclePlate(resident.vehiclePlates || '');
  };

  const handleCreateTardiness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedResident) {
      setFormError('Selecciona al residente para registrar el retardo.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await createTardiness(
        {
          residentId: selectedResident.id,
          residentName: selectedResident.fullName,
          houseNumber:
            selectedResident.houseNumber ||
            `${selectedResident.building} ${selectedResident.apartment}`.trim(),
          reason,
          vehiclePlate,
          notes,
        },
        actor
      );
      setShowModal(false);
      onClearPreselectedResident();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'No se pudo registrar el retardo.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!confirmDeleteRecord) return;
    setDeleting(true);
    try {
      await deleteTardiness(confirmDeleteRecord, actor);
      setConfirmDeleteRecord(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Registro de Retardos
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
            {tardinessList.length} registros acumulados
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenNew}
          className="min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 active:scale-[0.98] transition-all whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          Registrar Retardo
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por residente, unidad, placas o motivo..."
            className="w-full min-h-[44px] pl-10 pr-4 rounded-xl border border-slate-300 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-slate-900 focus:outline-none"
          />
        </div>
      </div>

      {filteredRecords.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
          <Clock className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-800">
            Sin registros de retardo
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Los retardos capturados en caseta o Android aparecerán aquí en tiempo real.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredRecords.map((record) => (
            <article
              key={record.id}
              className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between gap-3"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-slate-900 truncate">
                      {record.residentName}
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Unidad: {record.houseNumber}
                    </p>
                  </div>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteRecord(record)}
                      className="min-h-[44px] min-w-[44px] -mr-1 -mt-1 flex items-center justify-center rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      aria-label={`Eliminar retardo de ${record.residentName}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <p className="text-sm font-medium text-slate-800">
                  {record.reason}
                </p>

                <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-1 tabular-nums">
                  <span>{formatDateTime(record.timestampMillis)}</span>
                  {record.vehiclePlate && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono font-semibold text-slate-700">
                        {record.vehiclePlate}
                      </span>
                    </>
                  )}
                  <span aria-hidden="true">·</span>
                  <span>Registró: {record.registeredBy}</span>
                </div>

                {record.notes && (
                  <p className="text-xs text-slate-600 pt-1 border-t border-slate-100">
                    {record.notes}
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Modal: Registrar Retardo */}
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
                Registrar Retardo de Residente
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

            <form onSubmit={handleCreateTardiness} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Residente *
                </label>
                <input
                  type="text"
                  value={residentSearch}
                  onChange={(e) => {
                    setResidentSearch(e.target.value);
                    if (selectedResident) setSelectedResident(null);
                  }}
                  placeholder="Buscar residente por nombre, depto o placas..."
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
                        <span className="font-mono text-slate-500 ml-2 shrink-0">
                          {r.vehiclePlates || '—'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Motivo
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {TARDINESS_REASONS.map((r) => (
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
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 text-sm focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Placas del vehículo
                </label>
                <input
                  type="text"
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value.toUpperCase())}
                  placeholder="Ej. ABC-123"
                  className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-300 font-mono text-sm uppercase focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Notas
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Detalle adicional..."
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
                {saving ? 'Guardando retardo...' : 'Guardar Retardo'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirm Delete (Admin only) */}
      {confirmDeleteRecord && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4"
          onClick={() => setConfirmDeleteRecord(null)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-slate-900">
              Eliminar registro de retardo
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              ¿Eliminar el retardo de{' '}
              <strong className="text-slate-900">
                {confirmDeleteRecord.residentName}
              </strong>{' '}
              ({confirmDeleteRecord.houseNumber})? Esta acción quedará registrada en auditoría.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setConfirmDeleteRecord(null)}
                className="min-h-[44px] rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirmed}
                disabled={deleting}
                className="min-h-[44px] rounded-xl bg-red-600 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
