import React, { useMemo, useState } from 'react';
import {
  AlertOctagon,
  Building2,
  Car,
  CheckCircle2,
  Clock,
  KeyRound,
  Phone,
  Search,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';
import type { Resident } from '../types';
import { formatResidentLocation, normalizeText } from '../utils/formatters';

interface AccessVerificationViewProps {
  residents: Resident[];
  loading: boolean;
  onStartVisitForResident: (resident: Resident) => void;
  onStartTardinessForResident: (resident: Resident) => void;
}

export const AccessVerificationView: React.FC<AccessVerificationViewProps> = ({
  residents,
  loading,
  onStartVisitForResident,
  onStartTardinessForResident,
}) => {
  const [query, setQuery] = useState('');
  const [buildingFilter, setBuildingFilter] = useState<string>('TODOS');
  const [selectedResidentId, setSelectedResidentId] = useState<number | null>(null);

  const buildings = useMemo(() => {
    const set = new Set<string>();
    residents.forEach((r) => {
      if (r.building) set.add(r.building.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [residents]);

  const filteredResidents = useMemo(() => {
    const q = normalizeText(query);
    return residents
      .filter((r) => {
        if (buildingFilter !== 'TODOS' && r.building.trim() !== buildingFilter) {
          return false;
        }
        if (!q) return true;
        const haystacks = [
          r.accessCode,
          r.fullName,
          r.building,
          r.apartment,
          r.houseNumber,
          r.vehiclePlates,
          r.blockOrSection,
        ];
        return haystacks.some((field) => normalizeText(field || '').includes(q));
      })
      .sort((a, b) => {
        const qNorm = normalizeText(query);
        if (qNorm) {
          const aExact = normalizeText(a.accessCode) === qNorm ? 0 : 1;
          const bExact = normalizeText(b.accessCode) === qNorm ? 0 : 1;
          if (aExact !== bExact) return aExact - bExact;
        }
        return a.building.localeCompare(b.building, 'es') ||
          a.apartment.localeCompare(b.apartment, 'es', { numeric: true });
      });
  }, [residents, query, buildingFilter]);

  const activeResult: Resident | null = useMemo(() => {
    if (selectedResidentId !== null) {
      const found = residents.find((r) => r.id === selectedResidentId);
      if (found) return found;
    }
    const q = normalizeText(query);
    if (!q) return null;
    const exactCode = filteredResidents.find(
      (r) => normalizeText(r.accessCode) === q
    );
    if (exactCode) return exactCode;
    if (filteredResidents.length === 1) return filteredResidents[0];
    return null;
  }, [residents, selectedResidentId, query, filteredResidents]);

  const stats = useMemo(() => {
    const total = residents.length;
    const morosos = residents.filter((r) => r.isMoroso).length;
    const alCorriente = total - morosos;
    return { total, morosos, alCorriente };
  }, [residents]);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    setSelectedResidentId(null);
  };

  return (
    <div className="space-y-5">
      {/* Search & Quick Filter Bar */}
      <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Validación de Clave de Acceso
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {stats.total} unidades · {stats.alCorriente} al corriente · {stats.morosos} con adeudo
            </p>
          </div>
        </div>

        <div className="relative">
          <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Clave, nombre, edificio, depto o placas..."
            aria-label="Buscar por clave, nombre, edificio, departamento o placas"
            className="w-full min-h-[52px] pl-12 pr-12 rounded-xl border border-slate-300 bg-slate-50 text-base font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-slate-900 focus:outline-none transition-colors"
          />
          {query && (
            <button
              type="button"
              onClick={() => handleQueryChange('')}
              aria-label="Limpiar búsqueda"
              className="min-h-[44px] min-w-[44px] absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {buildings.length > 0 && (
          <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => {
                setBuildingFilter('TODOS');
                setSelectedResidentId(null);
              }}
              className={`min-h-[40px] px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                buildingFilter === 'TODOS'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Todos ({residents.length})
            </button>
            {buildings.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => {
                  setBuildingFilter(b);
                  setSelectedResidentId(null);
                }}
                className={`min-h-[40px] px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                  buildingFilter === b
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {b}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Main Layout: Dominant Verification Result + Matching List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Dominant Verification Card */}
        <div className="lg:col-span-6">
          {activeResult ? (
            <div
              className={`rounded-3xl border overflow-hidden shadow-sm ${
                activeResult.isMoroso
                  ? 'bg-red-50 border-red-300'
                  : !activeResult.isActive
                  ? 'bg-amber-50 border-amber-300'
                  : 'bg-emerald-50 border-emerald-300'
              }`}
            >
              {/* Status Hero Banner */}
              <div
                className={`px-5 py-6 flex items-center gap-4 text-white ${
                  activeResult.isMoroso
                    ? 'bg-red-600'
                    : !activeResult.isActive
                    ? 'bg-amber-600'
                    : 'bg-emerald-600'
                }`}
              >
                {activeResult.isMoroso ? (
                  <AlertOctagon className="w-14 h-14 shrink-0" />
                ) : !activeResult.isActive ? (
                  <AlertOctagon className="w-14 h-14 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-14 h-14 shrink-0" />
                )}
                <div>
                  <p className="text-xs font-semibold opacity-90">
                    {activeResult.isMoroso
                      ? 'RESTRICCIÓN POR ADEUDO'
                      : !activeResult.isActive
                      ? 'ESTATUS DE UNIDAD'
                      : 'VERIFICACIÓN EXITOSA'}
                  </p>
                  <h3 className="text-xl sm:text-2xl font-bold leading-tight text-balance">
                    {activeResult.isMoroso
                      ? 'Acceso denegado por falta de pago'
                      : !activeResult.isActive
                      ? 'Residente inactivo'
                      : 'Acceso autorizado / Sí paga'}
                  </h3>
                </div>
              </div>

              {/* Resident Details */}
              <div className="p-5 bg-white space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-slate-500">
                      Residente titular
                    </p>
                    <p className="text-lg font-bold text-slate-900">
                      {activeResult.fullName}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-medium text-slate-500">Clave</p>
                    <p className="font-mono text-xl font-bold text-slate-900 tabular-nums">
                      {activeResult.accessCode || 'N/A'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 text-sm">
                  <div className="flex items-start gap-2.5">
                    <Building2 className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-slate-500">Edificio / Depto</p>
                      <p className="font-semibold text-slate-900">
                        {activeResult.building} · {activeResult.apartment}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <Car className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-slate-500">Placas</p>
                      <p className="font-mono font-semibold text-slate-900">
                        {activeResult.vehiclePlates || 'Sin registrar'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <Phone className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-slate-500">Teléfono</p>
                      <p className="font-mono text-slate-900 tabular-nums">
                        {activeResult.phone || '—'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <KeyRound className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-slate-500">Sección</p>
                      <p className="text-slate-900">
                        {activeResult.blockOrSection || 'General'}
                      </p>
                    </div>
                  </div>
                </div>

                {activeResult.notes && (
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-700">
                    <span className="font-semibold text-slate-900">Notas: </span>
                    {activeResult.notes}
                  </div>
                )}

                {/* One-Handed Quick Actions (>= 48px height) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => onStartVisitForResident(activeResult)}
                    className={`min-h-[48px] w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white active:scale-[0.98] transition-all ${
                      activeResult.isMoroso
                        ? 'bg-red-700 hover:bg-red-800'
                        : 'bg-slate-900 hover:bg-slate-800'
                    }`}
                  >
                    <UserPlus className="w-4 h-4" />
                    {activeResult.isMoroso
                      ? 'Visita (Moroso / Sin clave)'
                      : 'Registrar Visita'}
                  </button>

                  <button
                    type="button"
                    onClick={() => onStartTardinessForResident(activeResult)}
                    className="min-h-[48px] w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 active:scale-[0.98] transition-all"
                  >
                    <Clock className="w-4 h-4" />
                    Registrar Retardo
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center mb-4">
                <UserCheck className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Listo para validar acceso
              </h3>
              <p className="mt-1.5 text-sm text-slate-500 max-w-sm mx-auto">
                Escribe una clave de acceso o selecciona una unidad de la lista para ver su estatus de pago y autorización inmediata.
              </p>
            </div>
          )}
        </div>

        {/* Matching Residents List */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">
              Unidades coincidentes
            </h3>
            <span className="text-xs font-mono text-slate-500 tabular-nums">
              {filteredResidents.length}
            </span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Cargando catálogo en tiempo real...
            </div>
          ) : filteredResidents.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No hay residentes que coincidan con "{query}".
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 max-h-[540px] overflow-y-auto">
              {filteredResidents.slice(0, 60).map((resident) => {
                const isSelected = activeResult?.id === resident.id;
                return (
                  <li key={resident.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedResidentId(resident.id)}
                      className={`w-full min-h-[64px] px-4 py-3 text-left flex items-center justify-between gap-3 transition-colors ${
                        isSelected
                          ? 'bg-slate-100'
                          : 'hover:bg-slate-50 active:bg-slate-100'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900 truncate">
                          {resident.fullName}
                        </p>
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          {formatResidentLocation(resident)}
                          {resident.vehiclePlates ? ` · ${resident.vehiclePlates}` : ''}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                          {resident.accessCode || '—'}
                        </p>
                        <p
                          className={`text-xs font-semibold mt-0.5 ${
                            resident.isMoroso
                              ? 'text-red-600'
                              : !resident.isActive
                              ? 'text-amber-600'
                              : 'text-emerald-600'
                          }`}
                        >
                          {resident.isMoroso
                            ? 'Moroso'
                            : !resident.isActive
                            ? 'Inactivo'
                            : 'Autorizado'}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
